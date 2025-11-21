package migrations

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
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
		logger.Info("Data migrations are disabled, skipping")
		return nil
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
	// To add a new resource type, simply add another migration here with the appropriate resources
	registerResourceMigrations(mg, migrator, client)

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

func registerResourceMigrations(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
	dashboardsAndFolders := NewResourceMigration(
		migrator,
		[]schema.GroupResource{
			{Group: "folder.grafana.app", Resource: "folders"},
			{Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
		"folders-dashboards",
		NewCountValidator(client, map[string]LegacyTableInfo{
			"folder.grafana.app/folders":       {Table: "dashboard", WhereClause: "org_id = ? and is_folder = true"},
			"dashboard.grafana.app/dashboards": {Table: "dashboard", WhereClause: "org_id = ? and is_folder = false"},
		}),
	)
	mg.AddMigration("folders and dashboards migration", dashboardsAndFolders)
}
