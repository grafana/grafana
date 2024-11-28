package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path"
	"strings"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

	// TODO: We need some way to filter what we import.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, kinds, err := c.client.New(ns)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a dynamic client: %w", err)))
			return
		}
		fileParser := resources.NewParser(repo, client, kinds)

		folderIface := client.Resource(schema.GroupVersionResource{
			Group:    "folder.grafana.app",
			Version:  "v0alpha1",
			Resource: "folders",
		})

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

			// Calculate name based on the file path
			name := path.Base(entry.Path)
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
			// The parse function will fill in the repository metadata, so copy it over here
			info.Hash = entry.Hash
			info.Modified = nil // modified?

			// NOTE: We're validating here to make sure we want the folders to be created.
			//  If the file isn't valid, its folders aren't relevant, either.
			file, err := fileParser.Parse(r.Context(), logger, info, true)
			if err != nil {
				logger.DebugContext(ctx, "error on parsing the entry's data", "error", err)
				if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
					// Non-resource data is not relevant to us.
					logger.DebugContext(ctx, "ignoring file due to being a non-resource", "error", err)
					continue
				}
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to read %s: %w", entry.Path, err)))
				return
			}

			logger = logger.With("gvk", file.GVK)
			if file.Client == nil {
				logger.DebugContext(ctx, "unable to find client for", "obj", file.Obj)
				continue
			}

			// TODO: Don't create folders for resources that aren't folder-able. Maybe we can check the annotations for this?
			dir := path.Dir(entry.Path)
			parent := repo.Config().Spec.Folder
			if dir != "." && dir != "/" {
				logger := logger.With("dir", dir)
				logger.DebugContext(ctx, "creating directories")
				for _, folder := range strings.Split(dir, "/") {
					logger := logger.With("folder", folder)
					obj, err := folderIface.Get(r.Context(), folder, metav1.GetOptions{})
					// FIXME: Check for IsNotFound properly
					if obj != nil || err == nil {
						logger.DebugContext(ctx, "folder already existed")
						continue
					}

					_, err = folderIface.Create(r.Context(), &unstructured.Unstructured{
						Object: map[string]interface{}{
							"metadata": map[string]any{
								"name":      folder,
								"namespace": ns,
								"annotations": map[string]any{
									apiutils.AnnoKeyFolder: parent,
								},
							},
							"spec": map[string]any{
								"title":       folder, // TODO: how do we want to get this?
								"description": "Repository-managed folder.",
							},
						},
					}, metav1.CreateOptions{})
					if err != nil {
						logger.DebugContext(ctx, "failed to create folder", "error", err)
						responder.Error(apierrors.NewInternalError(fmt.Errorf("got error when creating folder %s: %w", folder, err)))
						return
					}
					parent = folder
					logger.DebugContext(ctx, "folder created")
				}
			}

			if file.GVR == nil {
				logger.DebugContext(ctx, "no GVR found")
				continue
			}

			file.Obj.SetName(name)
			file.Meta.SetFolder(parent)

			_, err = file.Client.Get(r.Context(), name, metav1.GetOptions{})
			// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
			if false && err != nil && !apierrors.IsNotFound(err) {
				logger.DebugContext(ctx, "failed to check if the object already exists", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to check if object already exists: %w", err)))
				return
			}

			logger.DebugContext(ctx, "upserting kube object", "name", file.Obj.GetName())
			if err != nil { // IsNotFound
				_, err = file.Client.Create(r.Context(), file.Obj, metav1.CreateOptions{})
			} else { // already exists
				_, err = file.Client.Update(r.Context(), file.Obj, metav1.UpdateOptions{})
			}
			if err != nil {
				logger.DebugContext(ctx, "failed to upsert object", "error", err)
				responder.Error(err) // FIXME
				return
			}

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
