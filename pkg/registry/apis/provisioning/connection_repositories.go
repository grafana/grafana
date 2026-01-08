package provisioning

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type connectionRepositoriesConnector struct{}

func NewConnectionRepositoriesConnector() *connectionRepositoriesConnector {
	return &connectionRepositoriesConnector{}
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
	ctx = logging.Context(ctx, logger)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.ConnectionResourceInfo.GroupResource(), r.Method))
			return
		}

		// TODO: Implement repository listing from external git provider
		// This will require:
		// 1. Get the Connection object
		// 2. Use the connection credentials to authenticate with the git provider
		// 3. List repositories from the provider (GitHub, GitLab, Bitbucket)
		// 4. Return ExternalRepositoryList with Name, Owner, and URL for each repository

		responder.Error(apierrors.NewMethodNotSupported(provisioning.ConnectionResourceInfo.GroupResource(), "repositories endpoint not yet implemented"))
	}), nil
}

var (
	_ rest.Storage         = (*connectionRepositoriesConnector)(nil)
	_ rest.Connecter       = (*connectionRepositoriesConnector)(nil)
	_ rest.StorageMetadata = (*connectionRepositoriesConnector)(nil)
)
