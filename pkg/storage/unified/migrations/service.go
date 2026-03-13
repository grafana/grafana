package migrations

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/sqlutil"
	migrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")
var logger = log.New("storage.unified.migrations")
var migrationStatusMetric = prometheus.NewGauge(prometheus.GaugeOpts{
	Namespace: "grafana",
	Name:      "unified_storage_migration_status",
	Help:      "Status of unified storage data migrations on this instance.",
})

type UnifiedStorageMigrationServiceImpl struct {
	migrator     UnifiedMigrator
	tableLocker  MigrationTableLocker
	tableRenamer MigrationTableRenamer
	cfg          *setting.Cfg
	sqlStore     sqlutil.SessionProvider
	client       resource.ResourceClient
	registry     *MigrationRegistry
}

var _ contract.UnifiedStorageMigrationService = (*UnifiedStorageMigrationServiceImpl)(nil)

// ProvideUnifiedStorageMigrationService is a Wire provider that creates the migration service.
func ProvideUnifiedStorageMigrationService(
	unifiedMigrator UnifiedMigrator,
	sql legacysql.LegacyDatabaseProvider,
	cfg *setting.Cfg,
	sqlStore sqlutil.SessionProvider,
	_ any,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) contract.UnifiedStorageMigrationService {
	return &UnifiedStorageMigrationServiceImpl{
		migrator:     unifiedMigrator,
		tableLocker:  newTableLocker(sqlStore, sql),
		tableRenamer: newTableRenamer(sqlStore.GetSqlxSession().DriverName(), logger, cfg.RenameWaitDeadline),
		cfg:          cfg,
		sqlStore:     sqlStore,
		client:       client,
		registry:     registry,
	}
}

func isTargetEligibleForMigrations(targets []string) bool {
	return slices.Contains(targets, "all") || slices.Contains(targets, "core")
}

func (p *UnifiedStorageMigrationServiceImpl) shouldRunMigrations() bool {
	return !p.cfg.DisableDataMigrations &&
		p.cfg.UnifiedStorageType() == "unified" &&
		isTargetEligibleForMigrations(p.cfg.Target)
}

func (p *UnifiedStorageMigrationServiceImpl) Run(ctx context.Context) error {
	if !p.shouldRunMigrations() {
		migrationStatusMetric.Set(1)
		logger.Info("Data migrations are disabled, skipping",
			"disableDataMigrations", p.cfg.DisableDataMigrations,
			"unifiedStorageType", p.cfg.UnifiedStorageType(),
			"target", p.cfg.Target,
		)
		return nil
	}

	logger.Info("Running migrations for unified storage")
	migrationStatusMetric.Set(3)
	return RegisterMigrations(ctx, p.migrator, p.tableLocker, p.tableRenamer, p.cfg, p.sqlStore, p.client, p.registry)
}

// EnsureMigrationLogTable creates the unifiedstorage_migration_log table if it doesn't exist.
func EnsureMigrationLogTable(ctx context.Context, sqlStore sqlutil.SessionProvider, cfg *setting.Cfg) error {
	mg := migrator.NewScopedMigrator(sqlStore.GetSqlxSession(), "unifiedstorage")
	mg.AddCreateMigration()
	sec := cfg.Raw.Section("database")
	return mg.RunMigrations(ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt())
}

func RegisterMigrations(
	ctx context.Context,
	unifiedMigrator UnifiedMigrator,
	tableLocker MigrationTableLocker,
	tableRenamer MigrationTableRenamer,
	cfg *setting.Cfg,
	sqlStore sqlutil.SessionProvider,
	client resource.ResourceClient,
	registry *MigrationRegistry,
) error {
	ctx, span := tracer.Start(ctx, "storage.unified.RegisterMigrations")
	defer span.End()
	mg := migrator.NewScopedMigrator(sqlStore.GetSqlxSession(), "unifiedstorage")
	mg.AddCreateMigration()

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	if err := validateRegisteredResources(registry); err != nil {
		return err
	}

	if err := registerMigrations(cfg, mg, unifiedMigrator, tableLocker, tableRenamer, client, registry); err != nil {
		return err
	}

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	db := mg.SqlDB()
	maxOpenConns := db.Stats().MaxOpenConnections
	maxConcurrentRenameConns := 0
	if mg.Dialect.DriverName() == migrator.MySQL {
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
