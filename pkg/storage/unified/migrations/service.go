package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")
var logger = log.New("storage.unified.migrations")

type UnifiedStorageMigrationServiceImpl struct {
	migrator UnifiedMigrator
	cfg      *setting.Cfg
	sqlStore db.DB
	kv       kvstore.KVStore
	client   resource.ResourceClient
	registry *MigrationRegistry
}

var _ contract.UnifiedStorageMigrationService = (*UnifiedStorageMigrationServiceImpl)(nil)

// ProvideUnifiedStorageMigrationService is a Wire provider that creates the migration service.
func ProvideUnifiedStorageMigrationService(
	migrator UnifiedMigrator,
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) contract.UnifiedStorageMigrationService {
	return &UnifiedStorageMigrationServiceImpl{
		migrator: migrator,
		cfg:      cfg,
		sqlStore: sqlStore,
		kv:       kv,
		client:   client,
		registry: registry,
	}
}

func (p *UnifiedStorageMigrationServiceImpl) Run(ctx context.Context) error {
	// skip migrations if disabled in config
	if p.cfg.DisableDataMigrations {
		metrics.MUnifiedStorageMigrationStatus.Set(1)
		logger.Info("Data migrations are disabled, skipping")
		return nil
	}

	logger.Info("Running migrations for unified storage")
	metrics.MUnifiedStorageMigrationStatus.Set(3)
	return RegisterMigrations(ctx, p.migrator, p.cfg, p.sqlStore, p.client, p.registry)
}

// EnsureMigrationLogTable creates the unifiedstorage_migration_log table if it doesn't exist.
func EnsureMigrationLogTable(ctx context.Context, sqlStore db.DB, cfg *setting.Cfg) error {
	mg := sqlstoremigrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unifiedstorage")
	mg.AddCreateMigration()
	sec := cfg.Raw.Section("database")
	return mg.RunMigrations(ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt())
}

func RegisterMigrations(
	ctx context.Context,
	migrator UnifiedMigrator,
	cfg *setting.Cfg,
	sqlStore db.DB,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) error {
	ctx, span := tracer.Start(ctx, "storage.unified.RegisterMigrations")
	defer span.End()
	mg := sqlstoremigrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unifiedstorage")
	mg.AddCreateMigration()

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	if err := validateRegisteredResources(registry); err != nil {
		return err
	}

	if err := registerMigrations(ctx, cfg, mg, migrator, client, sqlStore, registry); err != nil {
		return err
	}

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	db := mg.DBEngine.DB().DB
	maxOpenConns := db.Stats().MaxOpenConnections
	if maxOpenConns <= 3 {
		// migrations require at least 4 connections due to extra GRPC connections and DB lock
		db.SetMaxOpenConns(4)
		defer db.SetMaxOpenConns(maxOpenConns)
	}
	err := mg.RunMigrations(ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt())
	if err != nil {
		return fmt.Errorf("unified storage data migration failed: %w", err)
	}

	logger.Info("Unified storage migrations completed successfully")
	return nil
}
