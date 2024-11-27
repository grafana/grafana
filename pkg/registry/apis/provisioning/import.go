package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, err := c.client.Client(ns)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a dynamic client: %w", err)))
			return
		}
		kinds := newKindsLookup(client)
		fileParser := newFileParser(ns, repo, client, kinds)

		ref := r.URL.Query().Get("ref")
		if ref == "" {
			responder.Error(apierrors.NewBadRequest("no ref value was given"))
			return
		}

		tree, err := repo.ReadTree(r.Context(), logger, ref)
		if err != nil {
			responder.Error(err) // TODO: do we want to do anything more for this?
			return
		}
		for _, entry := range tree {
			logger := logger.With("file", entry.Path)
			name := filepath.Base(entry.Path)
			if strings.ContainsRune(name, '.') {
				name = name[:strings.LastIndex(name, ".")]
			}
			logger = logger.With("dashboard_name", name)

			info, err := repo.Read(r.Context(), logger, entry.Path, ref)
			if err != nil {
				logger.DebugContext(ctx, "error on reading the entry", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read %s: %w", entry.Path, err)))
				return
			}

			// NOTE: We don't need validation because we're about to apply the data for real.
			// If the data is invalid, we'll know then!
			file, err := fileParser.parse(r.Context(), logger, info, false)
			if err != nil {
				logger.DebugContext(ctx, "error on parsing the entry's data", "error", err)
				if errors.Is(err, ErrUnableToReadResourceBytes) {
					// Non-resource data is not relevant to us.
					logger.DebugContext(ctx, "ignoring file due to being a non-resource", "error", err)
					continue
				}
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read %s: %w", entry.Path, err)))
				return
			}

			wrapper := file.AsResourceWrapper()
			resource := wrapper.Resource.File
			gv, err := schema.ParseGroupVersion(resource.GetNestedString("apiVersion"))
			if err != nil {
				logger.DebugContext(ctx, "invalid GroupVersion was given as the apiVersion of the parsed object?", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("got an invalid groupversion from a parsed file %s: %w", entry.Path, err)))
				return
			}
			gvk := gv.WithKind(resource.GetNestedString("kind"))
			logger = logger.With("gvk", gvk)
			gvr, ok := kinds.Resource(gvk)
			if !ok {
				logger.DebugContext(ctx, "got GVK of a resource we don't know how to control; ignoring")
				continue
			}
			iface := client.Resource(gvr).Namespace(ns)
			_, err = iface.Get(r.Context(), name, metav1.GetOptions{})
			if err != nil && !apierrors.IsNotFound(err) {
				logger.DebugContext(ctx, "failed to check if the object already exists", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to check if object already exists: %w", err)))
				return
			}
			if err != nil { // IsNotFound
				_, err = iface.Create(r.Context(), resource.ToKubernetesObject(), metav1.CreateOptions{})
			} else { // already exists
				_, err = iface.Update(ctx, resource.ToKubernetesObject(), metav1.UpdateOptions{})
			}
			if err != nil {
				logger.DebugContext(ctx, "failed to upsert object", "error", err)
				responder.Error(err) // FIXME
				return
			}

			// TODO: Folders
			logger.DebugContext(ctx, "successfully upserted the object")
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
