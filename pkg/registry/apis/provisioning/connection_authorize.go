package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

const authorizeMaxBodySize = 64 * 1024

type ConnectionAuthorizeAccess interface {
	ConnectionGetter
	GetConnectionSpec(ctx context.Context, name string) (*provisioning.Connection, error)
	GetClient() client.ProvisioningV0alpha1Interface
}

type connectionAuthorizeRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirectUri"`
}

type connectionAuthorizeConnector struct {
	access ConnectionAuthorizeAccess
}

func NewConnectionAuthorizeConnector(access ConnectionAuthorizeAccess) *connectionAuthorizeConnector {
	return &connectionAuthorizeConnector{
		access: access,
	}
}

func (*connectionAuthorizeConnector) New() runtime.Object {
	return &provisioning.TestResults{}
}

func (*connectionAuthorizeConnector) Destroy() {}

func (*connectionAuthorizeConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*connectionAuthorizeConnector) ProducesObject(verb string) any {
	return &provisioning.TestResults{}
}

func (*connectionAuthorizeConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*connectionAuthorizeConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *connectionAuthorizeConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(ctx).With("logger", "connection-authorize-connector", "connection_name", name)
		ctx := logging.Context(ctx, logger)

		if r.Method != http.MethodPost {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.ConnectionResourceInfo.GroupResource(), r.Method))
			return
		}

		var req connectionAuthorizeRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, authorizeMaxBodySize)).Decode(&req); err != nil {
			responder.Error(apierrors.NewBadRequest("invalid request body"))
			return
		}
		if req.Code == "" {
			responder.Error(apierrors.NewBadRequest("code is required"))
			return
		}

		conn, err := c.access.GetConnectionSpec(ctx, name)
		if err != nil {
			responder.Error(err)
			return
		}

		built, err := c.access.GetConnection(ctx, name)
		if err != nil {
			logger.Error("failed to build connection", "error", err)
			responder.Error(err)
			return
		}

		ac, ok := built.(connection.AuthCodeConnection)
		if !ok {
			responder.Error(&apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusNotImplemented,
					Reason:  "NotImplemented",
					Message: "authorization code exchange not implemented for given connection type",
				},
			})
			return
		}

		token, err := ac.ExchangeAuthorizationCode(ctx, req.Code, req.RedirectURI)
		if err != nil {
			logger.Error("failed to exchange authorization code", "error", err)
			responder.Error(apierrors.NewBadRequest("failed to exchange authorization code"))
			return
		}

		patcher := appcontroller.NewConnectionStatusPatcher(c.access.GetClient())
		patchOps := []map[string]interface{}{
			{
				"op":   "add",
				"path": "/secure/token",
				"value": map[string]string{
					"create": string(token),
				},
			},
			{
				"op":    "add",
				"path":  "/status/token",
				"value": provisioning.TokenStatus{LastUpdated: time.Now().UnixMilli()},
			},
			// Reset the health check timestamp so the controller re-tests the
			// connection right away instead of keeping the pre-authorization
			// failure around until the next periodic check.
			{
				"op":    "replace",
				"path":  "/status/health/checked",
				"value": 0,
			},
		}
		if err := patcher.Patch(ctx, conn, patchOps...); err != nil {
			logger.Error("failed to store connection token", "error", err)
			responder.Error(apierrors.NewInternalError(err))
			return
		}

		// Best-effort: point the connection URL at the OAuth application settings
		// page when the provider can resolve it with the fresh token.
		if appURL := ac.ResolveAppURL(ctx, token); appURL != "" {
			specPatch, err := json.Marshal([]map[string]interface{}{
				{"op": "add", "path": "/spec/url", "value": appURL},
			})
			if err == nil {
				if _, err := c.access.GetClient().Connections(conn.Namespace).Patch(ctx, conn.Name, types.JSONPatchType, specPatch, metav1.PatchOptions{}); err != nil {
					logger.Warn("failed to update connection URL", "error", err)
				}
			}
		}

		responder.Object(http.StatusOK, &provisioning.TestResults{
			TypeMeta: metav1.TypeMeta{
				APIVersion: provisioning.APIVERSION,
				Kind:       "TestResults",
			},
			Code:    http.StatusOK,
			Success: true,
		})
	}), nil
}

var (
	_ rest.Storage         = (*connectionAuthorizeConnector)(nil)
	_ rest.Connecter       = (*connectionAuthorizeConnector)(nil)
	_ rest.StorageMetadata = (*connectionAuthorizeConnector)(nil)
)
