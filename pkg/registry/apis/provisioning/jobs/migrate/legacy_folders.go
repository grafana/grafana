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

//go:generate mockery --name LegacyFoldersMigrator --structname MockLegacyFoldersMigrator --inpackage --filename mock_legacy_folders_migrator.go --with-expecter
type LegacyFoldersMigrator interface {
	resource.BulkResourceWriter
	Migrate(ctx context.Context, namespace string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error
}

type legacyFoldersMigrator struct {
	tree           resources.FolderTree
	legacyMigrator legacy.LegacyMigrator
}

func NewLegacyFoldersMigrator(legacyMigrator legacy.LegacyMigrator) LegacyFoldersMigrator {
	return &legacyFoldersMigrator{
		legacyMigrator: legacyMigrator,
		tree:           resources.NewEmptyFolderTree(),
	}
}

// Close implements resource.BulkResourceWrite.
func (f *legacyFoldersMigrator) Close() error {
	return nil
}

// CloseWithResults implements resource.BulkResourceWrite.
func (f *legacyFoldersMigrator) CloseWithResults() (*resource.BulkResponse, error) {
	return &resource.BulkResponse{}, nil
}

// Write implements resource.BulkResourceWrite.
func (f *legacyFoldersMigrator) Write(ctx context.Context, key *resource.ResourceKey, value []byte) error {
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

func (f *legacyFoldersMigrator) Migrate(ctx context.Context, namespace string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "read folders from SQL")
	if _, err := f.legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
		Namespace: namespace,
		Resources: []schema.GroupResource{resources.FolderResource.GroupResource()},
		Store:     parquet.NewBulkResourceWriterClient(f),
	}); err != nil {
		return fmt.Errorf("read folders from SQL: %w", err)
	}

	progress.SetMessage(ctx, "export folders from SQL")
	// FIXME: we don't sign folders, not even with grafana user
	if err := repositoryResources.EnsureFolderTreeExists(ctx, "", "", f.tree, func(folder resources.Folder, created bool, err error) error {
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
		return err
	}); err != nil {
		return fmt.Errorf("export folders from SQL: %w", err)
	}

	return nil
}
