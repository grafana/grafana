package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type importConnector struct {
	repoGetter RepoGetter
	client     *resourceClient
	logger     *slog.Logger
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
	ns := repo.Config().GetNamespace()

	// TODO: We need some way to filter what we import.

	replicatorFactory := newReplicatorFactory(c.client, ns)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		replicator, err := replicatorFactory.New()
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create replicator: %w", err)))
			return
		}

		ref := r.URL.Query().Get("ref")
		logger := logger.With("ref", ref)

		tree, err := repo.ReadTree(r.Context(), logger, ref)
		if err != nil {
			responder.Error(err) // TODO: do we want to do anything more for this?
			return
		}

		for _, entry := range tree {
			logger := logger.With("file", entry.Path)
			if !entry.Blob {
				logger.DebugContext(ctx, "ignoring non-blob entry")
				continue
			}

			info, err := repo.Read(r.Context(), logger, entry.Path, ref)
			if err != nil {
				logger.DebugContext(ctx, "error on reading the entry", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read %s: %w", entry.Path, err)))
				return
			}

			if err := replicator.Replicate(r.Context(), info); err != nil {
				logger.DebugContext(ctx, "error on replicating the entry", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to replicate %s: %w", entry.Path, err)))
				return
			}
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
