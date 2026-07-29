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

type LibraryPanelsMigrator interface {
	MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// foldersDashboardsMigrator handles migrating dashboards and folders
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

// libraryPanelsMigrator handles migrating library panels from legacy SQL storage.
type libraryPanelsMigrator struct {
	migrator legacy.Migrator
}

// ProvideLibraryPanelsMigrator creates a libraryPanelsMigrator for use in wire DI.
func ProvideLibraryPanelsMigrator(
	migrator legacy.Migrator,
) LibraryPanelsMigrator {
	return &libraryPanelsMigrator{
		migrator: migrator,
	}
}

// MigrateLibraryPanels reads library panels from legacy SQL storage and streams them
// to the unified storage bulk process API.
func (m *libraryPanelsMigrator) MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	return m.migrator.MigrateLibraryPanels(ctx, orgId, opts, stream)
}
