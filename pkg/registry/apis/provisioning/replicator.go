package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

type replicatorFactory struct {
	repo      repository.Repository
	client    *resources.ClientFactory
	namespace string
}

func newReplicatorFactory(client *resources.ClientFactory, namespace string, repo repository.Repository) *replicatorFactory {
	return &replicatorFactory{
		client:    client,
		namespace: namespace,
		repo:      repo,
	}
}

func (f *replicatorFactory) New() (repository.FileReplicator, error) {
	dynamicClient, kinds, err := f.client.New(f.namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get client for namespace %s: %w", f.namespace, err)
	}

	parser := resources.NewParser(f.repo, dynamicClient, kinds)
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	return &replicator{
		logger:  slog.Default().With("logger", "replicator", "namespace", f.namespace),
		parser:  parser,
		client:  dynamicClient,
		folders: folders,
	}, nil
}

type replicator struct {
	logger  *slog.Logger
	client  *resources.DynamicClient
	parser  *resources.FileParser
	folders dynamic.ResourceInterface
}

// Replicate creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *replicator) Replicate(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	parent, err := r.createFolderPath(ctx, fileInfo.Path)
	if err != nil {
		return fmt.Errorf("failed to create folder path: %w", err)
	}

	_, err = file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if parent != "" {
		file.Meta.SetFolder(parent)
	}

	if err != nil { // IsNotFound
		_, err = file.Client.Create(ctx, file.Obj, metav1.CreateOptions{})
	} else { // already exists
		_, err = file.Client.Update(ctx, file.Obj, metav1.UpdateOptions{})
	}

	if err != nil {
		return fmt.Errorf("failed to upsert object: %w", err)
	}

	r.logger.InfoContext(ctx, "Replicated file", "name", file.Obj.GetName(), "path", fileInfo.Path)

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
					"namespace": r.client.GetNamespace(),
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

		logger.InfoContext(ctx, "folder created")

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

	_, err = file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if err != nil { // IsNotFound
		return ErrFileNotFound
	}

	if err = file.Client.Delete(ctx, file.Obj.GetName(), metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	// TODO: delete folders if empty recursively

	r.logger.InfoContext(ctx, "Deleted file", "name", file.Obj.GetName(), "path", fileInfo.Path)

	return nil
}

func (r *replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*resources.ParsedFile, error) {
	// NOTE: We're validating here to make sure we want the folders to be created.
	//  If the file isn't valid, its folders aren't relevant, either.
	file, err := r.parser.Parse(ctx, r.logger, fileInfo, true)
	if err != nil {
		// FIXME: We should probably handle this in the callers to do a warning or ignore.
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return nil, ErrUnableToReadResourceBytes
		}

		return nil, fmt.Errorf("failed to parse file %s: %w", fileInfo.Path, err)
	}

	if file.GVR == nil {
		return nil, errors.New("parsed file is missing GVR")
	}

	if file.Client == nil {
		return nil, errors.New("parsed file is missing client")
	}

	return file, nil
}
