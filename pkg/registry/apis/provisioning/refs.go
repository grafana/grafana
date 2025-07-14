package provisioning

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type refsConnector struct {
	getter RepoGetter
}

func NewRefsConnector(getter RepoGetter) *refsConnector {
	return &refsConnector{getter: getter}
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
	return []string{http.MethodGet}
}

func (*refsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *refsConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "refs-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)
	repo, err := c.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
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
