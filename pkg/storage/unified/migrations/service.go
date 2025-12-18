package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
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
	// skip migrations if disabled in config
	if p.cfg.DisableDataMigrations {
		metrics.MUnifiedStorageMigrationStatus.Set(1)
		logger.Info("Data migrations are disabled, skipping")
		return nil
	}

	// TODO: read migration table to determine if migrations are needed

	// Check auto mode 5 for resources with entries below threshold
	if err := p.checkAutoMode5(ctx); err != nil {
		logger.Warn("Failed to check auto mode 5", "error", err)
		// Don't fail the migration, continue with normal flow
	}

	logger.Info("Running migrations for unified storage")
	metrics.MUnifiedStorageMigrationStatus.Set(3)
	return RegisterMigrations(ctx, p.migrator, p.cfg, p.sqlStore, p.client)
}

func RegisterMigrations(
	ctx context.Context,
	migrator UnifiedMigrator,
	cfg *setting.Cfg,
	sqlStore db.DB,
	client resource.ResourceClient,
) error {
	ctx, span := tracer.Start(ctx, "storage.unified.RegisterMigrations")
	defer span.End()
	mg := sqlstoremigrator.NewScopedMigrator(sqlStore.GetEngine(), cfg, "unifiedstorage")
	mg.AddCreateMigration()

	if err := prometheus.Register(mg); err != nil {
		logger.Warn("Failed to register migrator metrics", "error", err)
	}

	if err := validateRegisteredResources(); err != nil {
		return err
	}

	if err := registerMigrations(cfg, mg, migrator, client); err != nil {
		return err
	}

	// Run all registered migrations (blocking)
	sec := cfg.Raw.Section("database")
	db := mg.DBEngine.DB().DB
	maxOpenConns := db.Stats().MaxOpenConnections
	if maxOpenConns <= 2 {
		// migrations require at least 3 connections due to extra GRPC connections
		db.SetMaxOpenConns(3)
		defer db.SetMaxOpenConns(maxOpenConns)
	}
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

// checkAutoMode5 checks if resources have entries below the threshold and automatically
// enables mode 5 for those resources. This allows fresh installations or instances with
// minimal data to skip the full migration process and go directly to unified storage.
func (p *UnifiedStorageMigrationServiceImpl) checkAutoMode5(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "storage.unified.checkAutoMode5")
	defer span.End()

	// Get all orgs to count resources across all namespaces
	orgs, err := p.getAllOrgs(ctx)
	if err != nil {
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	if len(orgs) == 0 {
		logger.Info("No organizations found, skipping auto mode 5 check")
		return nil
	}

	// Check each migration group (resources that are migrated together must all meet the threshold)
	for _, migration := range migrationRegistry {
		if err := p.checkMigrationGroupAutoMode5(ctx, migration, orgs); err != nil {
			logger.Warn("Failed to check auto mode 5 for migration group", "migration", migration.name, "error", err)
			// Continue checking other groups
		}
	}

	return nil
}

// checkMigrationGroupAutoMode5 checks if all resources in a migration group have entries
// below their thresholds and auto-enables migration and mode 5 for all of them if so.
// This allows fresh installations or instances with minimal data to skip the full migration
// process and go directly to unified storage.
// For migration groups like folders+dashboards, ALL resources must be below threshold
// before ANY of them are switched to mode 5.
func (p *UnifiedStorageMigrationServiceImpl) checkMigrationGroupAutoMode5(ctx context.Context, migration migrationDefinition, orgs []orgInfo) error {
	// First, check preconditions for all resources in the group
	for _, res := range migration.resources {
		config := p.cfg.GetUnifiedStorageConfig(res)
		// Skip entire group if auto mode 5 is explicitly disabled for this resource (threshold < 0)
		if config.AutoMode5Threshold < 0 {
			logger.Debug("Auto mode 5 disabled for resource in migration group",
				"resource", res, "migration", migration.name)
			return nil
		}
		// Skip entire group if already in mode 5
		if config.DualWriterMode == 5 {
			logger.Debug("Resource already in mode 5", "resource", res)
			return nil
		}
	}

	// Check if the migration has already been run - if so, enable mode 5 without counting
	if migration.migrationID != "" {
		exists, err := p.migrationExists(ctx, migration.migrationID)
		if err != nil {
			logger.Warn("Failed to check if migration exists", "migration", migration.name, "error", err)
			// Continue with counting as fallback
		} else if exists {
			logger.Info("Migration already exists in log, enabling mode 5 for all resources",
				"migration", migration.name, "migrationID", migration.migrationID)
			for _, res := range migration.resources {
				p.cfg.EnableAutoMode5ForResource(res)
			}
			return nil
		}
	}

	// Build the list of group resources to count
	groupResources := make([]schema.GroupResource, 0, len(migration.resources))
	for _, res := range migration.resources {
		def := getResourceDefinitionByName(res)
		if def == nil {
			logger.Warn("Resource definition not found", "resource", res)
			continue
		}
		groupResources = append(groupResources, def.GroupResource)
	}

	if len(groupResources) == 0 {
		return nil
	}

	// Count entries across all orgs and check against thresholds
	resourceCounts := make(map[string]int64)
	for _, gr := range groupResources {
		resourceCounts[gr.String()] = 0
	}

	for _, org := range orgs {
		namespace := types.OrgNamespaceFormatter(org.ID)
		migrationCtx, _ := identity.WithServiceIdentityForSingleNamespace(ctx, namespace)

		rsp, err := p.migrator.Migrate(migrationCtx, legacy.MigrateOptions{
			Namespace: namespace,
			Resources: groupResources,
			OnlyCount: true,
		})
		if err != nil {
			return fmt.Errorf("failed to count resources for org %d: %w", org.ID, err)
		}

		for _, summary := range rsp.Summary {
			key := fmt.Sprintf("%s.%s", summary.Resource, summary.Group)
			resourceCounts[key] += summary.Count
		}
	}

	logger.Debug("Resource counts for migration group", "migration", migration.name, "counts", resourceCounts)

	// Check if all resources meet their thresholds
	allBelowThreshold := true
	for _, res := range migration.resources {
		config := p.cfg.GetUnifiedStorageConfig(res)
		count := resourceCounts[res]
		threshold := int64(config.AutoMode5Threshold)

		// If threshold is 0, use the default
		if threshold == 0 {
			threshold = int64(setting.DefaultAutoMode5Threshold)
		}

		if count > threshold {
			logger.Debug("Resource count exceeds threshold",
				"resource", res,
				"count", count,
				"threshold", threshold)
			allBelowThreshold = false
			break
		}

		logger.Debug("Resource count is at or below threshold",
			"resource", res,
			"count", count,
			"threshold", threshold)
	}

	if !allBelowThreshold {
		return nil
	}

	// All resources in the group are below threshold, auto-enable migration and mode 5 for all
	for _, res := range migration.resources {
		count := resourceCounts[res]
		logger.Info("Auto-enabling migration and mode 5 for resource due to low entry count",
			"resource", res,
			"count", count,
			"migration", migration.name)
		p.cfg.EnableAutoMode5ForResource(res)
	}
	return nil
}

// getResourceDefinitionByName looks up a resource definition by its full resource name
// (e.g., "folders.folder.grafana.app")
func getResourceDefinitionByName(resourceName string) *ResourceDefinition {
	for i := range resourceRegistry {
		r := &resourceRegistry[i]
		fullName := fmt.Sprintf("%s.%s", r.GroupResource.Resource, r.GroupResource.Group)
		if fullName == resourceName {
			return r
		}
	}
	return nil
}

// getAllOrgs retrieves all organizations from the database
func (p *UnifiedStorageMigrationServiceImpl) getAllOrgs(ctx context.Context) ([]orgInfo, error) {
	var orgs []orgInfo
	err := p.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("org").Cols("id", "name").Find(&orgs)
	})
	if err != nil {
		return nil, err
	}
	return orgs, nil
}

// migrationLogTableName is the name of the migration log table used by the scoped migrator
const migrationLogTableName = "unifiedstorage_migration_log"

// migrationExists checks if a migration with the given ID exists in the migration log table.
// This is used to determine if a migration has already been run, allowing us to skip
// resource counting and directly enable mode 5.
func (p *UnifiedStorageMigrationServiceImpl) migrationExists(ctx context.Context, migrationID string) (bool, error) {
	var count int64
	err := p.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		count, err = sess.Table(migrationLogTableName).Where("migration_id = ?", migrationID).Count()
		return err
	})
	if err != nil {
		return false, fmt.Errorf("failed to check migration existence: %w", err)
	}
	return count > 0, nil
}
