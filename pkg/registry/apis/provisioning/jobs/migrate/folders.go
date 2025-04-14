package migrate

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const maxFolders = 10000

var _ resource.BulkResourceWriter = (*LegacyFoldersMigrator)(nil)

type LegacyFoldersMigrator struct {
	tree           resources.FolderTree
	legacyMigrator legacy.LegacyMigrator
}

func NewLegacyFoldersMigrator(legacyMigrator legacy.LegacyMigrator) *LegacyFoldersMigrator {
	return &LegacyFoldersMigrator{
		legacyMigrator: legacyMigrator,
		tree:           resources.NewEmptyFolderTree(),
	}
}

// Close implements resource.BulkResourceWrite.
func (f *LegacyFoldersMigrator) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWrite.
func (f *LegacyFoldersMigrator) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWrite.
func (f *LegacyFoldersMigrator) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
	item := &unstructured.Unstructured{}
	err := item.UnmarshalJSON(value)
	if err != nil {
		return fmt.Errorf("unmarshal unstructured to JSON: %w", err)
	}

	if f.tree.Count() > maxFolders {
		return errors.New("too many folders")
	}

	// TODO: should we check if managed already and abort migration?

	return f.tree.AddUnstructured(item)
}

func (f *LegacyFoldersMigrator) Migrate(ctx context.Context, legacyMigrator legacy.LegacyMigrator, namespace string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "read folders from SQL")
	if _, err := legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
		Namespace: namespace,
		Resources: []schema.GroupResource{resources.FolderResource.GroupResource()},
		Store:     parquet.NewBulkResourceWriterClient(f),
	}); err != nil {
		return fmt.Errorf("read folders from SQL: %w", err)
	}

	progress.SetMessage(ctx, "export folders from SQL")
	if err := repositoryResources.EnsureFolderTreeExists(ctx, "", "", f.Tree(), func(folder resources.Folder, created bool, err error) error {
		result := jobs.JobResourceResult{
			Action:   repository.FileActionCreated,
			Name:     folder.ID,
			Resource: resources.FolderResource.Resource,
			Group:    resources.FolderResource.Group,
			Path:     folder.Path,
			Error:    err,
		}

		if !created {
			result.Action = repository.FileActionIgnored
		}

		progress.Record(ctx, result)
		return nil
	}); err != nil {
		return fmt.Errorf("export folders from SQL: %w", err)
	}

	return nil
}

func (f *LegacyFoldersMigrator) Tree() resources.FolderTree {
	return f.tree
}
