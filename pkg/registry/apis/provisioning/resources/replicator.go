package resources

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
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

type ReplicatorFactory struct {
	repo      repository.Repository
	client    *ClientFactory
	namespace string
}

func NewReplicatorFactory(client *ClientFactory, namespace string, repo repository.Repository) *ReplicatorFactory {
	return &ReplicatorFactory{
		client:    client,
		namespace: namespace,
		repo:      repo,
	}
}

func (f *ReplicatorFactory) New() (repository.FileReplicator, error) {
	dynamicClient, kinds, err := f.client.New(f.namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get client for namespace %s: %w", f.namespace, err)
	}

	parser := NewParser(f.repo, dynamicClient, kinds)
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	return &replicator{
		logger:     slog.Default().With("logger", "replicator", "namespace", f.namespace),
		parser:     parser,
		client:     dynamicClient,
		folders:    folders,
		repository: f.repo,
	}, nil
}

type replicator struct {
	logger     *slog.Logger
	client     *DynamicClient
	parser     *FileParser
	folders    dynamic.ResourceInterface
	repository repository.Repository
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

	r.logger.InfoContext(ctx, "Replicated file", "name", file.Obj.GetName(), "path", fileInfo.Path, "parent", parent)

	return nil
}

func (r *replicator) createFolderPath(ctx context.Context, filePath string) (string, error) {
	dir := filepath.Dir(filePath)
	parent := r.repository.Config().Spec.Folder
	if dir == "." {
		return parent, nil
	}

	logger := r.logger.With("file", filePath)
	for _, folder := range strings.Split(dir, string(filepath.Separator)) {
		logger := logger.With("folder", folder)
		obj, err := r.folders.Get(ctx, folder, metav1.GetOptions{})
		// FIXME: Check for IsNotFound properly
		if obj != nil || err == nil {
			logger.DebugContext(ctx, "folder already existed")
			parent = folder
			continue
		}

		_, err = r.folders.Create(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      folder,
					"namespace": r.client.GetNamespace(),
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
			return parent, fmt.Errorf("failed to create folder %s: %w", folder, err)
		}

		parent = folder
		logger.InfoContext(ctx, "folder created")
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
		return fmt.Errorf("get object to delete: %w", err)
	}

	if err = file.Client.Delete(ctx, file.Obj.GetName(), metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	// TODO: delete folders if empty recursively

	r.logger.InfoContext(ctx, "Deleted file", "name", file.Obj.GetName(), "path", fileInfo.Path)

	return nil
}

func (r *replicator) Validate(ctx context.Context, fileInfo *repository.FileInfo) (bool, error) {
	if _, err := r.parseResource(ctx, fileInfo); err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (r *replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*ParsedFile, error) {
	file, err := r.parser.Parse(ctx, r.logger, fileInfo, true)
	if err != nil {
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
