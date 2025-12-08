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
		metrics.MUnifiedStorageMigrationStatus.Set(1)
		logger.Info("Data migrations are disabled, skipping")
		return nil
	} else {
		metrics.MUnifiedStorageMigrationStatus.Set(2)
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

	if err := validateRegisteredResources(); err != nil {
		return err
	}

	// Register resource migrations
	registerDashboardAndFolderMigration(mg, migrator, client)
	registerPlaylistMigration(mg, migrator, client)

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	if err := mg.RunMigrations(ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt()); err != nil {
		return fmt.Errorf("unified storage data migration failed: %w", err)
	}

	logger.Info("Unified storage migrations completed successfully")
	return nil
}

func registerDashboardAndFolderMigration(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
	foldersDef := getResourceDefinition("folder.grafana.app", "folders")
	dashboardsDef := getResourceDefinition("dashboard.grafana.app", "dashboards")
	driverName := mg.Dialect.DriverName()

	folderCountValidator := NewCountValidator(
		client,
		foldersDef.GroupResource,
		"dashboard",
		"org_id = ? and is_folder = true",
		driverName,
	)

	dashboardCountValidator := NewCountValidator(
		client,
		dashboardsDef.GroupResource,
		"dashboard",
		"org_id = ? and is_folder = false",
		driverName,
	)

	folderTreeValidator := NewFolderTreeValidator(client, foldersDef.GroupResource, driverName)

	dashboardsAndFolders := NewResourceMigration(
		migrator,
		[]schema.GroupResource{foldersDef.GroupResource, dashboardsDef.GroupResource},
		"folders-dashboards",
		[]Validator{folderCountValidator, dashboardCountValidator, folderTreeValidator},
	)
	mg.AddMigration("folders and dashboards migration", dashboardsAndFolders)
}

func registerPlaylistMigration(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
	playlistsDef := getResourceDefinition("playlist.grafana.app", "playlists")
	driverName := mg.Dialect.DriverName()

	playlistCountValidator := NewCountValidator(
		client,
		playlistsDef.GroupResource,
		"playlist",
		"org_id = ?",
		driverName,
	)

	playlistsMigration := NewResourceMigration(
		migrator,
		[]schema.GroupResource{playlistsDef.GroupResource},
		"playlists",
		[]Validator{playlistCountValidator},
	)
	mg.AddMigration("playlists migration", playlistsMigration)
}
