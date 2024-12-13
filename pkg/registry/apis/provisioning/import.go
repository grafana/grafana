package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type importConnector struct {
	repoGetter RepoGetter
	client     *resources.ClientFactory
	logger     *slog.Logger
	ignore     provisioning.IgnoreFile
}

func (*importConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*importConnector) Destroy() {}

func (*importConnector) NamespaceScoped() bool {
	return true
}

func (*importConnector) GetSingularName() string {
	return "Import"
}

func (*importConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *importConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*importConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*importConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *importConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	logger := c.logger.With("repository_name", name)
	repo, err := c.repoGetter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	cfg := repo.Config()
	ns := cfg.GetNamespace()
	replicatorFactory := resources.NewReplicatorFactory(c.client, ns, repo, c.ignore)

	// TODO: We need some way to filter what we import.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		replicator, err := replicatorFactory.New()
		if err != nil {
			logger.ErrorContext(ctx, "failed to create replicator", "error", err)
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create replicator: %w", err)))
			return
		}

		ref := r.URL.Query().Get("ref")
		logger := logger.With("ref", ref)

		if err := replicator.ReplicateTree(r.Context(), ref); err != nil {
			logger.ErrorContext(ctx, "failed to replicate tree", "error", err)
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to replicate tree: %w", err)))
			return
		}

		responder.Object(http.StatusOK, &provisioning.ResourceWrapper{})
	}), nil
}

var (
	_ rest.Connecter            = (*importConnector)(nil)
	_ rest.Storage              = (*importConnector)(nil)
	_ rest.Scoper               = (*importConnector)(nil)
	_ rest.SingularNameProvider = (*importConnector)(nil)
	_ rest.StorageMetadata      = (*importConnector)(nil)
)
