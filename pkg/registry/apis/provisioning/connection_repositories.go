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
)

type connectionRepositoriesConnector struct {
	getter ConnectionGetter
}

func NewConnectionRepositoriesConnector(getter ConnectionGetter) *connectionRepositoriesConnector {
	return &connectionRepositoriesConnector{
		getter: getter,
	}
}

func (*connectionRepositoriesConnector) New() runtime.Object {
	return &provisioning.ExternalRepositoryList{}
}

func (*connectionRepositoriesConnector) Destroy() {}

func (*connectionRepositoriesConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*connectionRepositoriesConnector) ProducesObject(verb string) any {
	return &provisioning.ExternalRepositoryList{}
}

func (*connectionRepositoriesConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*connectionRepositoriesConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *connectionRepositoriesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "connection-repositories-connector", "connection_name", name)

	return WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.ConnectionResourceInfo.GroupResource(), r.Method))
			return
		}

		logger.Debug("listing repositories from connection")

		conn, err := c.getter.GetConnection(r.Context(), name)
		if err != nil {
			logger.Error("failed to get connection", "error", err)
			responder.Error(err)
			return
		}

		repos, err := conn.ListRepositories(r.Context())
		if err != nil {
			if errors.Is(err, connection.ErrNotImplemented) {
				logger.Debug("list repositories not implemented for connection type")
				responder.Error(&apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status:  metav1.StatusFailure,
						Code:    http.StatusNotImplemented,
						Reason:  "NotImplemented",
						Message: "list repositories not implemented for given connection type",
					},
				})
				return
			}
			logger.Error("failed to list repositories", "error", err)
			responder.Error(apierrors.NewInternalError(err))
			return
		}

		result := &provisioning.ExternalRepositoryList{
			Items: repos,
		}

		responder.Object(http.StatusOK, result)
	}), 30*time.Second), nil
}

var (
	_ rest.Storage         = (*connectionRepositoriesConnector)(nil)
	_ rest.Connecter       = (*connectionRepositoriesConnector)(nil)
	_ rest.StorageMetadata = (*connectionRepositoriesConnector)(nil)
)
