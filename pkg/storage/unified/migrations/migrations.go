package migrations

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")

// UnifiedStorageMigrationProvider provides unified storage migrations as a background service
type UnifiedStorageMigrationProvider interface {
	registry.BackgroundService
}

type UnifiedStorageMigrationProviderImpl struct {
	legacyMigrator legacy.LegacyMigrator
	cfg            *setting.Cfg
	client         resource.ResourceClient
	sqlStore       db.DB
}

var _ UnifiedStorageMigrationProvider = (*UnifiedStorageMigrationProviderImpl)(nil)

// ProvideUnifiedStorageMigrationProvider is a Wire provider that creates the migration service.
// The service implements registry.BackgroundService and runs migrations during server startup.
func ProvideUnifiedStorageMigrationProvider(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resource.ResourceClient,
	sqlStore db.DB,
) *UnifiedStorageMigrationProviderImpl {
	return &UnifiedStorageMigrationProviderImpl{
		legacyMigrator: legacyMigrator,
		cfg:            cfg,
		client:         client,
		sqlStore:       sqlStore,
	}
}

// Run executes unified storage migrations as a background service.
// This blocks until migrations complete. If migrations fail, an error is returned
// which will prevent Grafana from starting.
func (p *UnifiedStorageMigrationProviderImpl) Run(ctx context.Context) error {
	// skip migrations in test environments to prevent integration test timeouts.
	if os.Getenv("GRAFANA_TEST_DB") != "" {
		return nil
	}

	// TODO: Re-enable once migrations are ready
	// return RegisterMigrations(p.legacyMigrator, p.cfg, p.client, p.sqlStore)
	return nil
}

// RegisterMigrations initializes and registers all unified storage migrations.
// This function is the entry point for all data migrations from legacy storage
// to unified storage. It returns an error if migrations fail, preventing Grafana
// from starting with inconsistent data.
func RegisterMigrations(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resource.ResourceClient,
	sqlStore db.DB,
) error {
	ctx, span := tracer.Start(context.Background(), "storage.unified.RegisterMigrations")
	defer span.End()
	logger := log.New("storage.unified.migrations.folders-dashboards")
	mg := migrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unified_storage")
	mg.AddCreateMigration()

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	// Add new migration registrations here for each resource type
	registerDashboardAndFolderMigration(mg, legacyMigrator, client)

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	if err := mg.RunMigrations(ctx, sec.Key("migration_locking").MustBool(true), sec.Key("locking_attempt_timeout_sec").MustInt()); err != nil {
		return fmt.Errorf("unified storage data migration failed: %w", err)
	}

	logger.Info("Unified storage migrations completed successfully")
	return nil
}

func registerDashboardAndFolderMigration(
	mg *migrator.Migrator,
	legacyMigrator legacy.LegacyMigrator,
	bulkStoreClient resource.ResourceClient,
) {
	migration := &dashboardAndFolderMigration{
		legacyMigrator:  legacyMigrator,
		bulkStoreClient: bulkStoreClient,
	}
	mg.AddMigration(FoldersAndDashboardsMigrationID, migration)
}
