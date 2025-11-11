package tounifiedstorage

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var migrations = [...]string{
	PlaylistsMigrationID,
	FoldersAndDashboardsMigrationID,
}

const (
	CodeMigrationSQL = "code migration"

	disabledMigrationID = "rbac disabled migrator"
)

// LegacyMigrator interface for migrating legacy data to unified storage
// This avoids importing the legacy package directly to prevent import cycles
type LegacyMigrator interface {
	Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error)
}

// AddMigrator registers unified storage migrations with the provided dependencies
func AddMigrator(mg *migrator.Migrator, deps *Dependencies) {
	if mg.Cfg.SkipDataMigrations {
		return
	}

	// Check if dependencies are available
	if deps == nil {
		mg.Logger.Warn("Unified storage migrations enabled but dependencies not provided - skipping migrations")
		return
	}

	// Register migrations with their dependencies
	mg.AddMigration(PlaylistsMigrationID, &playlistsMigrator{deps: deps})
	mg.AddMigration(FoldersAndDashboardsMigrationID, &foldersAndDashboardsMigrator{deps: deps})
	// ..
}

type baseMigrator struct {
	migrator.MigrationBase
}

func (sp *baseMigrator) SQL(_ migrator.Dialect) string {
	return CodeMigrationSQL
}

type DisabledMigrator struct {
	migrator.MigrationBase
}
