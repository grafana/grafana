package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")

// MigrationService is a dummy service that ensures migrations are registered
// in the Wire dependency graph
type MigrationService struct{}

// ProvideMigrations is a Wire provider that creates and runs unified storage migrations.
// This function blocks Grafana startup until migrations complete. If migrations fail,
// Grafana will not start, ensuring data consistency.
func ProvideMigrations(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resourcepb.BulkStoreClient,
	sqlStore db.DB,
) (*MigrationService, error) {
	// Run migrations synchronously - block until complete
	if err := RegisterMigrations(legacyMigrator, cfg, client, sqlStore); err != nil {
		return nil, err
	}
	return &MigrationService{}, nil
}

// RegisterMigrations initializes and registers all unified storage migrations.
// This function is the entry point for all data migrations from legacy storage
// to unified storage. It returns an error if migrations fail, preventing Grafana
// from starting with inconsistent data.
func RegisterMigrations(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resourcepb.BulkStoreClient,
	sqlStore db.DB,
) error {
	ctx, span := tracer.Start(context.Background(), "storage.unified.RegisterMigrations")
	defer span.End()
	logger := log.New("storage.unified.migrations")
	mg := migrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unified-storage")

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	// Add new migration registrations here for each resource type
	registerDashboardAndFolderMigration(mg, legacyMigrator, client)

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	if err := mg.RunMigrations(ctx, sec.Key("migration_locking").MustBool(true), sec.Key("locking_attempt_timeout_sec").MustInt()); err != nil {
		logger.Error("Unified storage data migration failed", "error", err)
		return fmt.Errorf("unified storage data migration failed: %w", err)
	}

	logger.Info("Unified storage migrations completed successfully")
	return nil
}

func registerDashboardAndFolderMigration(
	mg *migrator.Migrator,
	legacyMigrator legacy.LegacyMigrator,
	bulkStoreClient resourcepb.BulkStoreClient,
) {
	migration := &dashboardAndFolderMigration{
		legacyMigrator:  legacyMigrator,
		bulkStoreClient: bulkStoreClient,
	}
	mg.AddMigration(FoldersAndDashboardsMigrationID, migration)
}
