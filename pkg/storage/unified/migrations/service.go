package migrations

import (
	"context"
	"fmt"
	"os"

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
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")
var logger = log.New("storage.unified.migrations")

type UnifiedStorageMigrationServiceImpl struct {
	migrator UnifiedMigrator
	cfg      *setting.Cfg
	sqlStore db.DB
	kv       kvstore.KVStore
	client   resource.ResourceClient
}

var _ contract.UnifiedStorageMigrationService = (*UnifiedStorageMigrationServiceImpl)(nil)

// ProvideUnifiedStorageMigrationService is a Wire provider that creates the migration service.
func ProvideUnifiedStorageMigrationService(
	migrator UnifiedMigrator,
	cfg *setting.Cfg,
	sqlStore db.DB,
	kv kvstore.KVStore,
	client resource.ResourceClient,
) contract.UnifiedStorageMigrationService {
	return &UnifiedStorageMigrationServiceImpl{
		migrator: migrator,
		cfg:      cfg,
		sqlStore: sqlStore,
		kv:       kv,
		client:   client,
	}
}

func (p *UnifiedStorageMigrationServiceImpl) Run(ctx context.Context) error {
	// TODO: temporary skip migrations in test environments to prevent integration test timeouts.
	if os.Getenv("GRAFANA_TEST_DB") != "" {
		return nil
	}

	// skip migrations if disabled in config
	if p.cfg.DisableDataMigrations {
		metrics.MUnifiedStorageMigrationStatus.WithLabelValues("config_disabled").Set(0)
		logger.Info("Data migrations are disabled, skipping")
		return nil
	} else {
		metrics.MUnifiedStorageMigrationStatus.WithLabelValues("would_run").Set(1)
		logger.Info("Data migrations not yet enforced, skipping")
	}

	// TODO: Re-enable once migrations are ready
	// TODO: add guarantee that this only runs once
	// return RegisterMigrations(p.migrator, p.cfg, p.sqlStore, p.client)
	return nil
}

func RegisterMigrations(
	migrator UnifiedMigrator,
	cfg *setting.Cfg,
	sqlStore db.DB,
	client resource.ResourceClient,
) error {
	ctx, span := tracer.Start(context.Background(), "storage.unified.RegisterMigrations")
	defer span.End()
	mg := sqlstoremigrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unifiedstorage")
	mg.AddCreateMigration()

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	// Register resource migrations
	registerDashboardAndFolderMigration(mg, migrator, client)

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	migrationLocking := sec.Key("migration_locking").MustBool(true)
	if mg.Dialect.DriverName() == sqlstoremigrator.SQLite {
		// disable migration locking for SQLite to avoid "database is locked" errors in the bulk operations
		migrationLocking = false
	}
	if err := mg.RunMigrations(ctx,
		migrationLocking,
		sec.Key("locking_attempt_timeout_sec").MustInt()); err != nil {
		return fmt.Errorf("unified storage data migration failed: %w", err)
	}

	logger.Info("Unified storage migrations completed successfully")
	return nil
}

func registerDashboardAndFolderMigration(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
	folders := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	dashboards := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	driverName := mg.Dialect.DriverName()

	folderCountValidator := NewCountValidator(
		client,
		folders,
		"dashboard",
		"org_id = ? and is_folder = true",
		driverName,
	)

	dashboardCountValidator := NewCountValidator(
		client,
		dashboards,
		"dashboard",
		"org_id = ? and is_folder = false",
		driverName,
	)

	folderTreeValidator := NewFolderTreeValidator(client, folders, driverName)

	dashboardsAndFolders := NewResourceMigration(
		migrator,
		[]schema.GroupResource{folders, dashboards},
		"folders-dashboards",
		[]Validator{folderCountValidator, dashboardCountValidator, folderTreeValidator},
	)
	mg.AddMigration("folders and dashboards migration", dashboardsAndFolders)
}
