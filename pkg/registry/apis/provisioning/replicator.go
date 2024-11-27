package provisioning

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	return &replicator{
		namespace: f.namespace,
		logger:    slog.Default().With("logger", "replicator", "namespace", f.namespace),
		parser:    parser,
		client:    dynamicClient,
	}, nil
}

type replicator struct {
	namespace string
	logger    *slog.Logger
	client    *dynamic.DynamicClient
	parser    *fileParser
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

	iface := r.client.Resource(*file.gvr).Namespace(r.namespace)
	_, err = iface.Get(ctx, name, metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
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

	r.logger.InfoContext(ctx, "Deleted file", "name", name, "path", fileInfo.Path)

	return nil
}

func (r *replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*parsedFile, error) {
	// NOTE: We don't need validation because we're about to apply the data for real.
	// If the data is invalid, we'll know then!
	file, err := r.parser.parse(ctx, r.logger, fileInfo, false)
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
