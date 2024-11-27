package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path"
	"path/filepath"
	"strings"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

type replicatorFactory struct {
	client    *resourceClient
	namespace string
}

func newReplicatorFactory(client *resourceClient, namespace string) *replicatorFactory {
	return &replicatorFactory{
		client:    client,
		namespace: namespace,
	}
}

func (f *replicatorFactory) New() (repository.FileReplicator, error) {
	dynamicClient, err := f.client.Client(f.namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get client for namespace %s: %w", f.namespace, err)
	}

	kinds := newKindsLookup(dynamicClient)
	parser := newFileParser(f.namespace, dynamicClient, kinds)

	folderGVR, ok := kinds.Resource(schema.GroupVersionKind{
		Group:   "folder.grafana.app",
		Version: "v0alpha1",
		Kind:    "Folder",
	})
	if !ok {
		return nil, errors.New("missing folder resource")
	}

	folders := dynamicClient.Resource(folderGVR).Namespace(f.namespace)

	return &replicator{
		namespace: f.namespace,
		logger:    slog.Default().With("logger", "replicator", "namespace", f.namespace),
		parser:    parser,
		client:    dynamicClient,
		folders:   folders,
	}, nil
}

type replicator struct {
	namespace string
	logger    *slog.Logger
	client    *dynamic.DynamicClient
	parser    *fileParser
	folders   dynamic.ResourceInterface
}

// Replicate creates a new resource in the cluster.
// If the resource already exists, it will be updated.
// TODO: Add support for folders
func (r *replicator) Replicate(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	name := resourceName(fileInfo.Path)

	parent, err := r.createFolderPath(ctx, fileInfo.Path)
	if err != nil {
		return fmt.Errorf("failed to create folder path: %w", err)
	}

	iface := r.client.Resource(*file.gvr).Namespace(r.namespace)
	_, err = iface.Get(ctx, name, metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	resource := file.AsResourceWrapper().Resource.File
	resource.SetNestedField(name, "metadata", "name")
	resource.SetNestedField(r.namespace, "metadata", "namespace")

	if parent != "" {
		resource.SetNestedField(parent, "metadata", "annotations", apiutils.AnnoKeyFolder)
	}

	obj := file.AsResourceWrapper().Resource.File.ToKubernetesObject()
	if err != nil { // IsNotFound
		_, err = iface.Create(ctx, obj, metav1.CreateOptions{})
	} else { // already exists
		_, err = iface.Update(ctx, obj, metav1.UpdateOptions{})
	}

	if err != nil {
		return fmt.Errorf("failed to upsert object: %w", err)
	}

	r.logger.InfoContext(ctx, "Replicated file", "name", name, "path", fileInfo.Path)

	return nil
}

func (r *replicator) createFolderPath(ctx context.Context, filePath string) (string, error) {
	dir := filepath.Dir(filePath)
	if dir == "." || dir == "/" {
		return "", nil
	}

	logger := r.logger.With("file", filePath)

	for _, folder := range strings.Split(dir, "/") {
		logger := logger.With("folder", folder)
		obj, err := r.folders.Get(ctx, folder, metav1.GetOptions{})
		// FIXME: Check for IsNotFound properly
		if obj != nil || err == nil {
			logger.DebugContext(ctx, "folder already existed")
			continue
		}

		_, err = r.folders.Create(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      folder,
					"namespace": r.namespace,
				},
				"spec": map[string]any{
					"title":       folder, // TODO: how do we want to get this?
					"description": "Repository-managed folder.",
				},
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to create folder %s: %w", folder, err)
		}

		logger.DebugContext(ctx, "folder created")

		// TODO: folder parents
		// TODO: the top-most folder's parent must be the repo folder.
	}

	parent := path.Base(path.Dir(filePath))
	if parent == "." || parent == "/" {
		return "", nil
	}

	return parent, nil
}

func (r *replicator) Delete(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	name := resourceName(fileInfo.Path)

	iface := r.client.Resource(*file.gvr).Namespace(r.namespace)
	_, err = iface.Get(ctx, name, metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if err != nil { // IsNotFound
		return ErrFileNotFound
	}

	if err = iface.Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	// TOOD: prune empty folders

	r.logger.InfoContext(ctx, "Deleted file", "name", name, "path", fileInfo.Path)

	return nil
}

func (r *replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*parsedFile, error) {
	// NOTE: We're validating here to make sure we want the folders to be created.
	//  If the file isn't valid, its folders aren't relevant, either.
	file, err := r.parser.parse(ctx, r.logger, fileInfo, true)
	if err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return nil, ErrUnableToReadResourceBytes
		}

		return nil, fmt.Errorf("failed to parse file %s: %w", fileInfo.Path, err)
	}

	if file.gvr == nil {
		return nil, errors.New("parsed file is missing GVR")
	}

	return file, nil
}

func resourceName(path string) string {
	name := filepath.Base(path)
	if strings.ContainsRune(name, '.') {
		name = name[:strings.LastIndex(name, ".")]
	}

	return name
}
