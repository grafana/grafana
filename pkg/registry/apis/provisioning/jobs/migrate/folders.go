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

var _ resource.BulkResourceWriter = (*LegacyFolderMigrator)(nil)

type LegacyFolderMigrator struct {
	tree           resources.FolderTree
	legacyMigrator legacy.LegacyMigrator
}

func NewLegacyFolderMigrator(legacyMigrator legacy.LegacyMigrator) *LegacyFolderMigrator {
	return &LegacyFolderMigrator{
		legacyMigrator: legacyMigrator,
		tree:           resources.NewEmptyFolderTree(),
	}
}

// Close implements resource.BulkResourceWrite.
func (f *LegacyFolderMigrator) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWrite.
func (f *LegacyFolderMigrator) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWrite.
func (f *LegacyFolderMigrator) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("unmarshal unstructured to JSON: %w", err)
	}

	if f.tree.Count() > maxFolders {
		return errors.New("too many folders")
	}

	return f.tree.AddUnstructured(item)
}

func (f *LegacyFolderMigrator) Read(ctx context.Context, legacyMigrator legacy.LegacyMigrator, namespace string) error {
	_, err := legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
		Namespace: namespace,
		Resources: []schema.GroupResource{resources.FolderResource.GroupResource()},
		Store:     parquet.NewBulkResourceWriterClient(f),
	})

	return err
}

func (f *LegacyFolderMigrator) Tree() resources.FolderTree {
	return f.tree
}
