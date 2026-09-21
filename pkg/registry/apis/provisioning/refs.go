package provisioning

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// RefsConnectorDependencies is satisfied by APIBuilder; it is split out from RepoGetter
// so the POST/ephemeral path (see buildEphemeralRepository) can build a non-persisted
// repository the same way the /test subresource does.
type RefsConnectorDependencies interface {
	RepoGetter
	ConnectionGetter
	GetRepoFactory() repository.Factory
}

type refsConnector struct {
	getter           RepoGetter
	connectionGetter ConnectionGetter
	repoFactory      repository.Factory
}

func NewRefsConnector(deps RefsConnectorDependencies) *refsConnector {
	return &refsConnector{
		getter:           deps,
		connectionGetter: deps,
		repoFactory:      deps.GetRepoFactory(),
	}
}

func (*refsConnector) New() runtime.Object {
	return &provisioning.RefList{}
}

func (*refsConnector) Destroy() {}

func (*refsConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*refsConnector) ProducesObject(verb string) any {
	return &provisioning.RefList{}
}

func (*refsConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPost}
}

func (*refsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *refsConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(ctx).With("logger", "refs-connector", "repository_name", name)
		ctx = logging.Context(ctx, logger)

		var repo repository.Repository
		var err error
		switch r.Method {
		case http.MethodGet:
			repo, err = c.getter.GetRepository(ctx, name)
		case http.MethodPost:
			// A POST body lists refs for a repository that hasn't been created yet,
			// the same "temporary repository" the /test subresource builds - used by
			// the onboarding wizard before it commits to creating anything.
			var ns string
			var ok bool
			ns, ok = request.NamespaceFrom(ctx)
			if !ok {
				responder.Error(apierrors.NewBadRequest("missing namespace"))
				return
			}
			repo, err = buildEphemeralRepository(ctx, r, name, ns, c.connectionGetter, c.repoFactory)
		default:
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
			return
		}
		if err != nil {
			logger.Debug("failed to find repository", "error", err)
			responder.Error(err)
			return
		}

		versionedRepo, ok := repo.(repository.Versioned)
		if !ok {
			responder.Error(apierrors.NewBadRequest("repository does not support versioned operations"))
			return
		}

		refs, err := versionedRepo.ListRefs(ctx)
		if err != nil {
			responder.Error(err)
			return
		}

		refsList := &provisioning.RefList{
			Items: refs,
		}

		responder.Object(http.StatusOK, refsList)
	}), nil
}

var (
	_ rest.Storage         = (*refsConnector)(nil)
	_ rest.Connecter       = (*refsConnector)(nil)
	_ rest.StorageMetadata = (*refsConnector)(nil)
)
