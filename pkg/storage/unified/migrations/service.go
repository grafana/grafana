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
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")
var logger = log.New("storage.unified.migrations")

type UnifiedStorageMigrationServiceImpl struct {
	migrator     UnifiedMigrator
	tableLocker  MigrationTableLocker
	tableRenamer MigrationTableRenamer
	cfg          *setting.Cfg
	sqlStore     db.DB
	kv           kvstore.KVStore
	client       resource.ResourceClient
	registry     *MigrationRegistry
}

var _ contract.UnifiedStorageMigrationService = (*UnifiedStorageMigrationServiceImpl)(nil)

// ProvideUnifiedStorageMigrationService is a Wire provider that creates the migration service.
func ProvideUnifiedStorageMigrationService(
	migrator UnifiedMigrator,
	sql legacysql.LegacyDatabaseProvider,
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) contract.UnifiedStorageMigrationService {
	return &UnifiedStorageMigrationServiceImpl{
		migrator:     migrator,
		tableLocker:  newTableLocker(sqlStore, sql),
		tableRenamer: newTableRenamer(string(sqlStore.GetDBType()), logger, cfg.RenameWaitDeadline),
		cfg:          cfg,
		sqlStore:     sqlStore,
		kv:           kv,
		client:       client,
		registry:     registry,
	}
}

func (p *UnifiedStorageMigrationServiceImpl) Run(ctx context.Context) error {
	if !p.cfg.ShouldRunMigrations() {
		metrics.MUnifiedStorageMigrationStatus.Set(1)
		logger.Info("Data migrations are disabled, skipping",
			"unifiedStorageType", p.cfg.UnifiedStorageType(),
			"target", p.cfg.Target,
		)
		return nil
	}

	logger.Info("Running migrations for unified storage")
	metrics.MUnifiedStorageMigrationStatus.Set(3)
	return RegisterMigrations(ctx, p.migrator, p.tableLocker, p.tableRenamer, p.cfg, p.sqlStore, p.client, p.registry)
}

// EnsureMigrationLogTable creates the unifiedstorage_migration_log table if it doesn't exist.
func EnsureMigrationLogTable(ctx context.Context, sqlStore db.DB, cfg *setting.Cfg) error {
	exists, err := sqlStore.GetEngine().IsTableExist(migrationLogTableName)
	if err != nil {
		return fmt.Errorf("failed to check migration log table existence: %w", err)
	}
	if exists {
		return nil
	}

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
	tableLocker MigrationTableLocker,
	tableRenamer MigrationTableRenamer,
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

	if err := registerMigrations(cfg, mg, migrator, tableLocker, tableRenamer, client, registry); err != nil {
		return err
	}

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	db := mg.DBEngine.DB().DB
	maxOpenConns := db.Stats().MaxOpenConnections
	maxConcurrentRenameConns := 0
	if mg.Dialect.DriverName() == sqlstoremigrator.MySQL {
		for _, m := range registry.All() {
			maxConcurrentRenameConns = max(maxConcurrentRenameConns, len(m.RenameTables))
		}
	}
	// Migrations require multiple concurrent connections:
	// 1 for advisory lock session, 1 for migration session,
	// 1 for READ lock (MySQL), 1 for legacy table reads (migrators),
	// and 1 per concurrent RENAME connection on MySQL
	neededConns := 4 + maxConcurrentRenameConns
	if maxOpenConns < neededConns {
		db.SetMaxOpenConns(neededConns)
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
