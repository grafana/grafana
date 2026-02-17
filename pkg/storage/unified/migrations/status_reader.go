package migrations

import (
	"context"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
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

// ProvideMigrationStatusReader creates a MigrationStatusReader
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

	if err := EnsureMigrationLogTable(context.Background(), sqlStore, cfg); err != nil {
		logger.Warn("Failed to ensure migration log table exists", "error", err)
		return reader
	}

	return reader
}

// GetStorageMode determines the storage mode for a resource.
//
// Resolution priority:
//  1. Config Mode1 (or Mode2/Mode3 for backward compat) → DualWrite
//     This is an explicit operational knob, primarily used in cloud to hold a resource
//     in dual-write mode for validation before promoting to unified.
//  2. Migration log entry exists → Unified (data has been synced)
//  3. Config Mode4/Mode5 → Unified (temporary fallback for cloud backfill transition)
//  4. Otherwise → Legacy
func (r *migrationStatusReader) GetStorageMode(ctx context.Context, gr schema.GroupResource) (contract.StorageMode, error) {
	// Check config for explicit DualWrite modes (Mode1, Mode2, Mode3).
	// This takes priority because it's an explicit operational decision — cloud may want
	// to hold a resource in dual-write even after data has been synced.
	configKey := gr.Resource + "." + gr.Group
	if config, found := r.cfg.UnifiedStorage[configKey]; found {
		if config.DualWriterMode >= rest.Mode1 && config.DualWriterMode <= rest.Mode3 {
			return contract.StorageModeDualWrite, nil
		}
	}

	// Check the migration log (primary source of truth for "data has been synced").
	def, ok := r.findDefinition(gr)
	if ok {
		exists, err := migrationExists(ctx, r.sqlStore, def.MigrationID)
		if err != nil {
			// If the migration log query fails (e.g., table not created yet),
			// log and fall through to the config fallback rather than failing hard.
			logger.Warn("Failed to check migration log, falling back to config", "resource", gr.String(), "error", err)
		} else if exists {
			return contract.StorageModeUnified, nil
		}
	}

	// Fallback: check config for Mode4+ (for environments where migrations are external).
	// This is temporary and will be removed once all environments backfill the migration log.
	if config, found := r.cfg.UnifiedStorage[configKey]; found {
		if config.DualWriterMode >= rest.Mode4 {
			return contract.StorageModeUnified, nil
		}
	}

	return contract.StorageModeLegacy, nil
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
