package migrations

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	registerStatusReaderMetricsOnce sync.Once

	migrationLogBootstrapFailuresMetric = metricutil.NewCounterStartingAtZero(prometheus.CounterOpts{
		Name: "migration_status_reader_bootstrap_failures_total",
		Help: "Total number of failures when ensuring the migration log table exists at startup",
	})
)

type statusReaderMetrics struct {
	bootstrapFailures prometheus.Counter
}

func provideStatusReaderMetrics(reg prometheus.Registerer) *statusReaderMetrics {
	registerStatusReaderMetricsOnce.Do(func() {
		if reg != nil {
			if err := reg.Register(migrationLogBootstrapFailuresMetric); err != nil {
				logger.Warn("Failed to register status reader metrics", "error", err)
			}
		} else {
			logger.Warn("No Prometheus registerer provided, status reader metrics will not be registered")
		}
	})
	return &statusReaderMetrics{
		bootstrapFailures: migrationLogBootstrapFailuresMetric,
	}
}

type migrationStatusReader struct {
	sqlStore db.DB
	cfg      *setting.Cfg
	registry *MigrationRegistry
	cache    *gocache.Cache
	metrics  *statusReaderMetrics
	onlyCfg  atomic.Bool
}

var _ contract.MigrationStatusReader = (*migrationStatusReader)(nil)

// ProvideMigrationStatusReader creates a MigrationStatusReader
func ProvideMigrationStatusReader(
	sqlStore db.DB,
	cfg *setting.Cfg,
	registry *MigrationRegistry,
	reg prometheus.Registerer,
) (contract.MigrationStatusReader, error) {
	cacheTTL := gocache.NoExpiration
	cacheCleanup := time.Duration(0)
	if cfg.StorageModeCacheTTL > 0 {
		cacheTTL = cfg.StorageModeCacheTTL
		cacheCleanup = cacheTTL * 2
	}

	metrics := provideStatusReaderMetrics(reg)
	reader := &migrationStatusReader{
		sqlStore: sqlStore,
		cfg:      cfg,
		registry: registry,
		cache:    gocache.New(cacheTTL, cacheCleanup),
		metrics:  metrics,
	}

	if err := EnsureMigrationLogTable(context.Background(), sqlStore, cfg); err != nil {
		metrics.bootstrapFailures.Inc()
		// Fail startup on lock errors
		if errors.Is(err, migrator.ErrMigratorIsLocked) || errors.Is(err, migrator.ErrLockDB) {
			return nil, fmt.Errorf("failed to ensure migration log table: %w", err)
		}
		// Can't create migration log table, fall back to config-only mode.
		reader.onlyCfg.Store(true)
		logger.Warn("Migration log table missing and bootstrap failed, falling back to config-driven resolution", "error", err)
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
	key := gr.String()
	if val, ok := r.cache.Get(key); ok {
		return val.(contract.StorageMode), nil
	}
	return r.resolveStorageMode(ctx, gr)
}

func (r *migrationStatusReader) resolveStorageMode(ctx context.Context, gr schema.GroupResource) (contract.StorageMode, error) {
	configKey := gr.Resource + "." + gr.Group
	// Config is used if table does not exist or in case of errors
	// DualWrite modes (Mode1, Mode2, Mode3) and Unified modes (Mode4, Mode5).
	mode := contract.StorageModeLegacy
	if config, found := r.cfg.UnifiedStorage[configKey]; found {
		if config.DualWriterMode >= rest.Mode1 && config.DualWriterMode <= rest.Mode3 {
			mode = contract.StorageModeDualWrite
		}
		if config.DualWriterMode >= rest.Mode4 {
			mode = contract.StorageModeUnified
		}
	}

	if r.onlyCfg.Load() {
		if !r.migrationLogTableAvailable() {
			logger.Debug("Migration log table not available, using config for storage mode resolution", "resource", gr.String(), "config_mode", configKey, "resolved_mode", mode)
			return mode, nil
		}
		logger.Info("Migration log table now available, using log-based resolution")
		r.onlyCfg.Store(false)
	}

	// The migration log is the source of truth for "data has been synced".
	// Cache the result of this check to avoid database queries on every request.
	def, ok := r.findDefinition(gr)
	if ok {
		exists, err := successfulMigrationExists(ctx, r.sqlStore, def.MigrationID)
		if err != nil {
			logger.Warn("Failed to check migration log, falling back to config", "resource", gr.String(), "error", err)
			return mode, fmt.Errorf("failed to resolve storage mode: resource=%s err=%w", gr.String(), err)
		}
		if exists {
			logger.Info("Resolved storage mode from migration log", "resource", gr.String(), "mode", contract.StorageModeUnified)
			r.cache.Set(gr.String(), contract.StorageModeUnified, gocache.NoExpiration)
			return contract.StorageModeUnified, nil
		}
		r.cache.SetDefault(gr.String(), mode)
	}
	return mode, nil
}

const tableExistsCacheKey = "__migration_log_table_exists"

// migrationLogTableAvailable checks whether the migration log table exists with cache TTL
func (r *migrationStatusReader) migrationLogTableAvailable() bool {
	if _, ok := r.cache.Get(tableExistsCacheKey); ok {
		return false
	}

	exists, err := r.sqlStore.GetEngine().IsTableExist(migrationLogTableName)
	if err != nil || !exists {
		r.cache.SetDefault(tableExistsCacheKey, false)
		return false
	}
	return true
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
