package migrations

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type migrationStatusReader struct {
	sqlStore db.DB
	cfg      *setting.Cfg
	registry *MigrationRegistry
}

var _ contract.MigrationStatusReader = (*migrationStatusReader)(nil)

// ProvideMigrationStatusReader creates a MigrationStatusReader and runs a one-time
// backfill of the migration log from config. The backfill handles environments
// (e.g., Grafana Cloud) where migrations are run externally and the migration log
// is not populated by the Grafana process itself.
func ProvideMigrationStatusReader(
	sqlStore db.DB,
	cfg *setting.Cfg,
	registry *MigrationRegistry,
) contract.MigrationStatusReader {
	reader := &migrationStatusReader{
		sqlStore: sqlStore,
		cfg:      cfg,
		registry: registry,
	}

	if err := reader.backfillFromConfig(context.Background()); err != nil {
		logger.Warn("Failed to backfill migration status from config", "error", err)
	}

	return reader
}

// IsMigrated checks whether a resource has been migrated to unified storage.
// It first checks the unifiedstorage_migration_log table (primary source of truth).
// As a temporary fallback, it also checks the static configuration for Mode4+.
func (r *migrationStatusReader) IsMigrated(ctx context.Context, gr schema.GroupResource) (bool, error) {
	// Check the migration log (primary source of truth).
	def, ok := r.findDefinition(gr)
	if ok {
		exists, err := migrationExists(ctx, r.sqlStore, def.MigrationID)
		if err != nil {
			return false, err
		}
		if exists {
			return true, nil
		}
	}

	// Fallback: check config for Mode4+ (for environments where migrations are external).
	// This is temporary and will be removed once all environments backfill the migration log.
	configKey := gr.Resource + "." + gr.Group
	if config, found := r.cfg.UnifiedStorage[configKey]; found {
		if config.DualWriterMode >= rest.Mode4 {
			return true, nil
		}
	}

	return false, nil
}

// findDefinition locates the MigrationDefinition that contains the given GroupResource.
func (r *migrationStatusReader) findDefinition(gr schema.GroupResource) (MigrationDefinition, bool) {
	for _, def := range r.registry.All() {
		for _, ri := range def.Resources {
			if ri.GroupResource == gr {
				return def, true
			}
		}
	}
	return MigrationDefinition{}, false
}

// backfillFromConfig writes synthetic migration log entries for resources that are
// configured as Mode4+ but don't have a migration log entry. This handles the case
// where migrations were run by external tooling (e.g., Grafana Cloud) and the
// migration log was never populated.
//
// This is idempotent: if an entry already exists, it's skipped.
func (r *migrationStatusReader) backfillFromConfig(ctx context.Context) error {
	for _, def := range r.registry.All() {
		if def.MigrationID == "" {
			continue
		}

		// Check if the migration log already has this entry.
		exists, err := migrationExists(ctx, r.sqlStore, def.MigrationID)
		if err != nil {
			logger.Warn("Failed to check migration log during backfill", "migration", def.ID, "error", err)
			continue
		}
		if exists {
			continue
		}

		// Check if ALL resources in this definition are configured as Mode4+.
		allMigrated := true
		for _, ri := range def.Resources {
			configKey := ri.Resource + "." + ri.Group
			config, found := r.cfg.UnifiedStorage[configKey]
			if !found || config.DualWriterMode < rest.Mode4 {
				allMigrated = false
				break
			}
		}

		if !allMigrated {
			continue
		}

		// Backfill: insert a synthetic migration log entry.
		err = r.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			record := sqlstoremigrator.MigrationLog{
				MigrationID: def.MigrationID,
				SQL:         "backfilled from config (external migration)",
				Success:     true,
				Timestamp:   time.Now(),
			}
			_, err := sess.Table(migrationLogTableName).Insert(&record)
			return err
		})
		if err != nil {
			logger.Warn("Failed to backfill migration log entry", "migration", def.ID, "error", err)
			continue
		}
		logger.Info("Backfilled migration log from config", "migration", def.ID, "migrationID", def.MigrationID)
	}
	return nil
}
