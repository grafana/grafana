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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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
		fileParser := newFileParser(ns, client, kinds)

		folderGVR, ok := kinds.Resource(schema.GroupVersionKind{
			Group:   "folder.grafana.app",
			Version: "v0alpha1",
			Kind:    "Folder",
		})
		if !ok {
			logger.DebugContext(ctx, "no folder GVR was returned")
			responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to find folder GVR")))
			return
		}
		folderIface := client.Resource(folderGVR).Namespace(ns)

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

			wrapper := file.AsResourceWrapper()
			resource := wrapper.Resource.File
			resource.SetNestedField(name, "metadata", "name")
			resource.SetNestedField(ns, "metadata", "namespace")
			if folder := path.Base(dir); folder != "." && folder != "/" {
				resource.SetNestedField(path.Base(dir), "metadata", "annotations", apiutils.AnnoKeyFolder)
			}

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
			// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
			if false && err != nil && !apierrors.IsNotFound(err) {
				logger.DebugContext(ctx, "failed to check if the object already exists", "error", err)
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to check if object already exists: %w", err)))
				return
			}
			kubeObj := resource.ToKubernetesObject()
			logger.DebugContext(ctx, "upserting kube object", "name", kubeObj.GetName())
			if err != nil { // IsNotFound
				_, err = iface.Create(r.Context(), kubeObj, metav1.CreateOptions{})
			} else { // already exists
				_, err = iface.Update(r.Context(), kubeObj, metav1.UpdateOptions{})
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
