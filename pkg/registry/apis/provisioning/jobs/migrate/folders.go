package migrate

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const maxFolders = 10000

var _ resource.BulkResourceWriter = (*legacyFolderReader)(nil)

type legacyFolderReader struct {
	tree           resources.FolderTree
	repoName       string
	legacyMigrator legacy.LegacyMigrator
	namespace      string
}

func NewLegacyFolderReader(legacyMigrator legacy.LegacyMigrator, repoName, namespace string) *legacyFolderReader {
	return &legacyFolderReader{
		legacyMigrator: legacyMigrator,
		repoName:       repoName,
		namespace:      namespace,
		tree:           resources.NewEmptyFolderTree(),
	}
}

// Close implements resource.BulkResourceWrite.
func (f *legacyFolderReader) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWrite.
func (f *legacyFolderReader) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWrite.
func (f *legacyFolderReader) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("unmarshal unstructured to JSON: %w", err)
	}

	if f.tree.Count() > maxFolders {
		return errors.New("too many folders")
	}

	return f.tree.AddUnstructured(item, f.repoName)
}

func (f *legacyFolderReader) Read(ctx context.Context, legacyMigrator legacy.LegacyMigrator, name, namespace string) error {
	_, err := legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
		Namespace: namespace,
		Resources: []schema.GroupResource{resources.FolderResource.GroupResource()},
		Store:     parquet.NewBulkResourceWriterClient(f),
	})
	return err
}

func (f *legacyFolderReader) Tree() resources.FolderTree {
	return f.tree
}
