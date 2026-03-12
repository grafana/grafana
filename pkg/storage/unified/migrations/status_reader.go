package migrations

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type migrationStatusReader struct {
	sqlStore                db.DB
	cfg                     *setting.Cfg
	registry                *MigrationRegistry
	migrationLogTableMu     sync.Mutex
	migrationLogTableExists bool
	completedMigrations     sync.Map
}

var _ contract.MigrationStatusReader = (*migrationStatusReader)(nil)

// ProvideMigrationStatusReader creates a MigrationStatusReader
func ProvideMigrationStatusReader(
	sqlStore db.DB,
	cfg *setting.Cfg,
	registry *MigrationRegistry,
) (contract.MigrationStatusReader, error) {
	reader := &migrationStatusReader{
		sqlStore: sqlStore,
		cfg:      cfg,
		registry: registry,
	}

	exists, err := reader.checkAndReadLogTable(context.Background())
	if err != nil {
		return nil, err
	}

	if !exists {
		logger.Info("Migration log table not found, using config fallback")
	}
	return reader, nil
}

// GetStorageMode determines the storage mode for a resource.
//
// Resolution priority:
//  1. Migration log entry exists → Unified (data has been synced)
//  2. Config Mode1 (or Mode2/Mode3 for backward compat) → DualWrite
//  3. Config Mode4/Mode5 → Unified (temporary fallback for cloud backfill transition)
//  4. Otherwise → Legacy
func (r *migrationStatusReader) GetStorageMode(ctx context.Context, gr schema.GroupResource) (contract.StorageMode, error) {
	configKey := gr.Resource + "." + gr.Group

	// The migration log is the source of truth for "data has been synced".
	def, ok := r.findDefinition(gr)
	if ok {
		exists, err := r.checkAndReadLogTable(ctx)
		if err != nil {
			return contract.StorageModeLegacy, err
		}

		if _, found := r.completedMigrations.Load(def.MigrationID); found {
			return contract.StorageModeUnified, nil
		}

		if exists {
			exists, err := migrationExists(ctx, r.sqlStore, def.MigrationID)
			if err != nil {
				return contract.StorageModeLegacy, fmt.Errorf("failed to resolve storage mode for %s from migration log: %w", gr.String(), err)
			}
			if exists {
				r.completedMigrations.Store(def.MigrationID, struct{}{})
				return contract.StorageModeUnified, nil
			}
		}
	}

	// Fallback to config for explicit DualWrite modes (Mode1, Mode2, Mode3) and Unified modes (Mode4, Mode5).
	// This is temporary and will be removed once all environments have migration logs.
	if config, found := r.cfg.UnifiedStorage[configKey]; found {
		if config.DualWriterMode >= rest.Mode1 && config.DualWriterMode <= rest.Mode3 {
			return contract.StorageModeDualWrite, nil
		}
		if config.DualWriterMode >= rest.Mode4 {
			return contract.StorageModeUnified, nil
		}
	}
	return contract.StorageModeLegacy, nil
}

func (r *migrationStatusReader) checkAndReadLogTable(ctx context.Context) (bool, error) {
	r.migrationLogTableMu.Lock()
	defer r.migrationLogTableMu.Unlock()

	if r.migrationLogTableExists {
		return true, nil
	}

	exists, err := migrationLogTableExists(r.sqlStore)
	if err != nil {
		return false, err
	}
	if !exists {
		return false, nil
	}
	r.migrationLogTableExists = true

	ids, err := migrationLogIDs(ctx, r.sqlStore)
	if err != nil {
		return false, err
	}
	for id := range ids {
		r.completedMigrations.Store(id, struct{}{})
	}
	return true, nil
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
