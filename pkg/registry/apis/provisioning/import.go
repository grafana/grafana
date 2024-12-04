package provisioning

import (
	"context"
	"errors"
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

	dynamicClient, kinds, err := c.client.New(ns)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	parser := resources.NewParser(ns, dynamicClient, kinds)
	replicator := resources.NewReplicator(dynamicClient, parser, repo.Config().Spec.Folder)

	// TODO: We need some way to filter what we import.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ref := r.URL.Query().Get("ref")
		logger := logger.With("ref", ref)

		tree, err := repo.ReadTree(r.Context(), logger, ref)
		if err != nil {
			logger.ErrorContext(ctx, "failed to read tree", "error", err)
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read tree: %w", err)))
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
				logger.ErrorContext(ctx, "failed to read file", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read %s: %w", entry.Path, err)))
				return
			}

			// The parse function will fill in the repository metadata, so copy it over here
			info.Hash = entry.Hash
			info.Modified = nil // modified?

			if err := replicator.Replicate(r.Context(), repo.Config(), info); err != nil {
				if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
					logger.InfoContext(ctx, "file does not contain a resource")
					continue
				}

				logger.ErrorContext(ctx, "failed to replicate file", "error", err)
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
