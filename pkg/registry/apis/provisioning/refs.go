package provisioning

import (
	"context"
	"fmt"
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

		refs, err := c.listRefs(ctx, repo)
		if err != nil {
			responder.Error(err)
			return
		}

		responder.Object(http.StatusOK, refs)
	}), nil
}

func (c *refsConnector) listRefs(ctx context.Context, repo repository.Repository) (*provisioning.RefList, error) {
	refsList := &provisioning.RefList{
		Items: []provisioning.RefItem{},
	}

	// Handle different repository types
	switch typedRepo := repo.(type) {
	case repository.GithubRepository:
		branches, err := typedRepo.ListBranches(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list branches: %w", err)
		}

		for _, branch := range branches {
			refsList.Items = append(refsList.Items, provisioning.RefItem{
				Name: branch.Name,
				Hash: branch.Sha,
			})
		}

	default:
		// For other repository types, we could potentially add support later
		// For now, return an empty list or an error
		return nil, apierrors.NewBadRequest("listing refs is not supported for this repository type")
	}

	return refsList, nil
}

var (
	_ rest.Storage         = (*refsConnector)(nil)
	_ rest.Connecter       = (*refsConnector)(nil)
	_ rest.StorageMetadata = (*refsConnector)(nil)
)
