package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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
	cfg := repo.Config()
	ns := cfg.GetNamespace()

	// TODO: We need some way to filter what we import.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client, err := c.client.Client(ns)
		if err != nil {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a dynamic client: %w", err)))
			return
		}
		kinds := newKindsLookup(client)
		fileParser := newFileParser(ns, repo, client, kinds)
		folderIface := client.Resource(schema.GroupVersionResource{
			Group:    "folder.grafana.app",
			Version:  "v0alpha1",
			Resource: "folders",
		}).Namespace(ns)

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

			// NOTE: We're validating here to make sure we want the folders to be created.
			//  If the file isn't valid, its folders aren't relevant, either.
			file, err := fileParser.parse(r.Context(), logger, info, true)
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

			if file.client == nil {
				logger.DebugContext(ctx, "unable to find client for", "obj", file.obj)
				continue
			}

			// TODO: Don't create folders for resources that aren't folder-able. Maybe we can check the annotations for this?
			dir := path.Dir(entry.Path)
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
					logger.DebugContext(ctx, "folder created")

					// TODO: folder parents
					// TODO: the top-most folder's parent must be the repo folder.
				}
			}

			if file.gvr == nil {
				logger.DebugContext(ctx, "no GVR found")
				continue
			}

			obj, err := utils.MetaAccessor(file.obj)
			if err != nil {
				logger.DebugContext(ctx, "error writing object", err)
				continue
			}

			obj.SetName(name)
			obj.SetNamespace(ns)
			obj.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
				Name:      cfg.Name,
				Path:      entry.Path,
				Hash:      entry.Hash,
				Timestamp: nil, // ?? is timestamp easy to get?
			})
			if folder := path.Base(dir); folder != "." && folder != "/" {
				obj.SetFolder(path.Base(dir))
			}

			logger = logger.With("gvk", file.gvk)

			_, err = file.client.Get(r.Context(), name, metav1.GetOptions{})
			// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
			if false && err != nil && !apierrors.IsNotFound(err) {
				logger.DebugContext(ctx, "failed to check if the object already exists", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to check if object already exists: %w", err)))
				return
			}

			logger.DebugContext(ctx, "upserting kube object", "name", obj.GetName())
			if err != nil { // IsNotFound
				_, err = file.client.Create(r.Context(), file.obj, metav1.CreateOptions{})
			} else { // already exists
				_, err = file.client.Update(r.Context(), file.obj, metav1.UpdateOptions{})
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
