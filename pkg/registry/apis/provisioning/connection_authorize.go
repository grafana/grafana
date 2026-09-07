package provisioning

import (
	"context"
	"errors"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

//go:generate mockery --name=ConnectionAuthorizeAccess --structname=MockConnectionAuthorizeAccess --inpackage --filename=connection_authorize_access_mock.go --with-expecter
type ConnectionAuthorizeAccess interface {
	ConnectionGetter
	repository.ConnectionSpecGetter
	GetClient() client.ProvisioningV0alpha1Interface
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
	return &provisioning.ConnectionAuthorizeRequest{}
}

func (*connectionAuthorizeConnector) Destroy() {}

func (*connectionAuthorizeConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*connectionAuthorizeConnector) ProducesObject(verb string) any {
	return &provisioning.ConnectionAuthorizeRequest{}
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

		var req provisioning.ConnectionAuthorizeRequest
		if err := unmarshalJSON(r, defaultMaxBodySize, &req); err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding ConnectionAuthorizeRequest from request"))
			return
		}
		if req.Spec.Code == "" {
			responder.Error(apierrors.NewBadRequest("spec.code is required"))
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

		ac, ok := built.(connection.OAuthConnection)
		if !ok {
			responder.Error(&apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusNotImplemented,
					Reason:  "NotImplemented",
					Message: "Authorization is not supported for this connection type",
				},
			})
			return
		}

		token, err := ac.ExchangeAuthorizationCode(ctx, req.Spec.Code, req.Spec.RedirectURI)
		if err != nil {
			logger.Error("failed to exchange authorization code", "error", err)
			responder.Error(apierrors.NewBadRequest("The provider rejected the authorization code. Verify the client secret and that it belongs to this client ID, then try again."))
			return
		}

		patcher := appcontroller.NewConnectionStatusPatcher(c.access.GetClient())
		patchOps := []map[string]any{
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
		}
		if err := patcher.Patch(ctx, conn, patchOps...); err != nil {
			logger.Error("failed to store connection token", "error", err)
			responder.Error(apierrors.NewInternalError(errors.New("failed to store the connection token")))
			return
		}

		req.Spec.Code = ""
		req.Status.Authorized = true
		responder.Object(http.StatusOK, &req)
	}), nil
}

var (
	_ rest.Storage         = (*connectionAuthorizeConnector)(nil)
	_ rest.Connecter       = (*connectionAuthorizeConnector)(nil)
	_ rest.StorageMetadata = (*connectionAuthorizeConnector)(nil)
)
