package migrations

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/migrations")

// MigrationRegistrar defines the interface for registering migrations
type MigrationRegistrar interface {
	// Register adds the migration to the migrator
	Register(mg *migrator.Migrator, deps *MigrationDependencies) error
}

// MigrationDependencies contains all dependencies needed for unified storage migrations
type MigrationDependencies struct {
	LegacyMigrator  legacy.LegacyMigrator
	BulkStoreClient resourcepb.BulkStoreClient
	Config          *setting.Cfg
	SqlStore        db.DB
	Logger          log.Logger
}

// ProvideMigrations is a Wire provider that creates and runs unified storage migrations
// as a background service. It returns a dummy service to satisfy Wire's dependency graph.
func ProvideMigrations(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resourcepb.BulkStoreClient,
	sqlStore db.DB,
) *MigrationService {
	// Run migrations in the background
	go RegisterMigrations(legacyMigrator, cfg, client, sqlStore)
	return &MigrationService{}
}

// MigrationService is a dummy service that ensures migrations are registered
// in the Wire dependency graph
type MigrationService struct{}

// RegisterMigrations initializes and registers all unified storage migrations.
// This function is the entry point for all data migrations from legacy storage
// to unified storage.
func RegisterMigrations(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resourcepb.BulkStoreClient,
	sqlStore db.DB,
) {
	ctx, span := tracer.Start(context.Background(), "unified.ProvideMigrations")
	defer span.End()
	logger := log.New("unified.storage.migrations")
	mg := migrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unified_storage")

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	// Create dependencies
	deps := createDependencies(legacyMigrator, cfg, client, sqlStore, logger)

	// Register all migrations
	// Add new migration registrations here for each resource type
	registerDashboardAndFolderMigration(mg, deps)

	// Run all registered migrations
	sec := cfg.Raw.Section("database")
	err := mg.RunMigrations(ctx, sec.Key("migration_locking").MustBool(true), sec.Key("locking_attempt_timeout_sec").MustInt())
	if err != nil {
		logger.Error("Unified storage data migration failed", "error", err)
	}
}

func createDependencies(
	legacyMigrator legacy.LegacyMigrator,
	cfg *setting.Cfg,
	client resourcepb.BulkStoreClient,
	sqlStore db.DB,
	logger log.Logger,
) *MigrationDependencies {
	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		logger.Error("Failed to create feature manager for data migration", "error", err)
		return nil
	}
	featureToggles := featuremgmt.ProvideToggles(featureManager)

	migrator := legacy.NewDashboardAccess(
		legacysql.NewDatabaseProvider(sqlStore),
		authlib.OrgNamespaceFormatter,
		nil, // no dashboards.Store
		nil, // no provisioning.Service // TODO: pass provisioning service
		nil, // no librarypanels.Service
		sort.ProvideService(),
		nil, // we don't delete during migration, and this is only need to delete permission.
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		featureToggles,
	)

	return &MigrationDependencies{
		LegacyMigrator:  migrator,
		BulkStoreClient: client,
		Config:          cfg,
		SqlStore:        sqlStore,
		Logger:          logger,
	}
}

func registerDashboardAndFolderMigration(mg *migrator.Migrator, deps *MigrationDependencies) {
	migration := &foldersAndDashboardsMigrator{
		legacyMigrator:  deps.LegacyMigrator,
		bulkStoreClient: deps.BulkStoreClient,
	}
	mg.AddMigration(FoldersAndDashboardsMigrationID, migration)
}
