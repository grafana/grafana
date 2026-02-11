package migrator

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type FoldersDashboardsMigrator interface {
	MigrateDashboards(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigrateFolders(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// foldersDashboardsMigrator handles migrating dashboards, folders, and library panels
// from legacy SQL storage.
type foldersDashboardsMigrator struct {
	migrator legacy.Migrator
}

// ProvideFoldersDashboardsMigrator creates a foldersDashboardsMigrator for use in wire DI.
func ProvideFoldersDashboardsMigrator(
	migrator legacy.Migrator,
) FoldersDashboardsMigrator {
	return &foldersDashboardsMigrator{
		migrator: migrator,
	}
}

// MigrateDashboards reads dashboards from legacy SQL storage and streams them
// to the unified storage bulk process API.
func (m *foldersDashboardsMigrator) MigrateDashboards(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	return m.migrator.MigrateDashboards(ctx, orgId, opts, stream)
}

// MigrateFolders reads folders from legacy SQL storage and streams them
// to the unified storage bulk process API.
func (m *foldersDashboardsMigrator) MigrateFolders(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	return m.migrator.MigrateFolders(ctx, orgId, opts, stream)
}

// MigrateLibraryPanels reads library panels from legacy SQL storage and streams them
// to the unified storage bulk process API.
func (m *foldersDashboardsMigrator) MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	return m.migrator.MigrateLibraryPanels(ctx, orgId, opts, stream)
}
