package migrations

import (
	"context"
	"fmt"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type resourceDefinition struct {
	groupResource schema.GroupResource
	migratorFunc  string // Name of the method: "MigrateFolders", "MigrateDashboards", etc.
}

type migrationDefinition struct {
	name         string
	migrationID  string // The ID stored in the migration log table (e.g., "playlists migration")
	resources    []string
	registerFunc func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient, opts ...ResourceMigrationOption)
	autoMigrate  bool
}

var resourceRegistry = []resourceDefinition{
	{
		groupResource: schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE},
		migratorFunc:  "MigrateFolders",
	},
	{
		groupResource: schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.LIBRARY_PANEL_RESOURCE},
		migratorFunc:  "MigrateLibraryPanels",
	},
	{
		groupResource: schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE},
		migratorFunc:  "MigrateDashboards",
	},
	{
		groupResource: schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"},
		migratorFunc:  "MigratePlaylists",
	},
}

var migrationRegistry = []migrationDefinition{
	{
		name:         "playlists",
		migrationID:  "playlists migration",
		resources:    []string{setting.PlaylistResource},
		registerFunc: registerPlaylistMigration,
		autoMigrate:  false,
	},
	{
		name:         "folders and dashboards",
		migrationID:  "folders and dashboards migration",
		resources:    []string{setting.FolderResource, setting.DashboardResource},
		registerFunc: registerDashboardAndFolderMigration,
		autoMigrate:  true,
	},
}

func registerMigrations(ctx context.Context,
	cfg *setting.Cfg,
	mg *sqlstoremigrator.Migrator,
	migrator UnifiedMigrator,
	client resource.ResourceClient,
	sqlStore db.DB,
) error {
	for _, migration := range migrationRegistry {
		if shouldAutoMigrate(ctx, migration, cfg, sqlStore) {
			logger.Info("Auto-migration enabled for resources", "migration", migration.name)
			enableMode5IfAlreadyMigrated(ctx, migration, cfg, sqlStore)
			migration.registerFunc(mg, migrator, client, WithAutoMigrate(cfg))
			continue
		}

		enabled, err := isMigrationEnabled(migration, cfg)
		if err != nil {
			return err
		}
		if !enabled {
			logger.Info("Migration is disabled in config, skipping", "migration", migration.name)
			continue
		}
		migration.registerFunc(mg, migrator, client)
	}
	return nil
}

func shouldAutoMigrate(ctx context.Context, migration migrationDefinition, cfg *setting.Cfg, sqlStore db.DB) bool {
	// Check if we should enable mode 5 based on counts
	for _, res := range migration.resources {
		config := cfg.GetUnifiedStorageConfig(res)

		// Skip if already in mode 5
		if config.DualWriterMode == 5 {
			return false
		}

		// Skip if auto migration is explicitly disabled
		if config.AutoMigrationThreshold < 0 {
			return false
		}

		threshold := int64(config.AutoMigrationThreshold)
		if threshold == 0 {
			threshold = int64(setting.DefaultAutoMigrationThreshold)
		}

		count, err := countResource(ctx, sqlStore, res)
		if err != nil {
			logger.Warn("Failed to count resource for auto mode 5 check", "resource", res, "error", err)
			return false
		}

		if count > threshold {
			return false
		}
	}

	logger.Info("Migration resource(s) below auto migration threshold", "migration", migration.name)
	return true
}

func enableMode5IfAlreadyMigrated(ctx context.Context, migration migrationDefinition, cfg *setting.Cfg, sqlStore db.DB) bool {
	if migration.migrationID == "" {
		return false
	}

	exists, err := migrationExists(ctx, sqlStore, migration.migrationID)
	if err != nil {
		logger.Warn("Failed to check if migration exists", "migration", migration.name, "error", err)
		return false
	}

	if !exists {
		return false
	}

	for _, res := range migration.resources {
		cfg.EnableAutoMode5(res)
		logger.Info("Migration already completed, enabling mode 5 for resource", "resource", res)
	}
	return true
}

func isMigrationEnabled(migration migrationDefinition, cfg *setting.Cfg) (bool, error) {
	var (
		hasValue   bool
		allEnabled bool
	)

	for _, res := range migration.resources {
		enabled := cfg.UnifiedStorage[res].EnableMigration
		if !hasValue {
			allEnabled = enabled
			hasValue = true
			continue
		}
		if enabled != allEnabled {
			return false, fmt.Errorf("cannot migrate resources separately: %v migration must be either all enabled or all disabled", migration.resources)
		}
	}

	return allEnabled, nil
}

func countResource(ctx context.Context, sqlStore db.DB, resourceName string) (int64, error) {
	var count int64
	err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		switch resourceName {
		case setting.DashboardResource:
			var err error
			count, err = sess.Table("dashboard").Where("is_folder = ?", false).Count()
			return err
		case setting.FolderResource:
			var err error
			count, err = sess.Table("dashboard").Where("is_folder = ?", true).Count()
			return err
		case setting.PlaylistResource:
			var err error
			count, err = sess.Table("playlist").Count()
			return err
		default:
			return fmt.Errorf("unknown resource: %s", resourceName)
		}
	})
	return count, err
}

const migrationLogTableName = "unifiedstorage_migration_log"

func migrationExists(ctx context.Context, sqlStore db.DB, migrationID string) (bool, error) {
	var count int64
	err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		count, err = sess.Table(migrationLogTableName).Where("migration_id = ?", migrationID).Count()
		return err
	})
	if err != nil {
		return false, fmt.Errorf("failed to check migration existence: %w", err)
	}
	return count > 0, nil
}

func getResourceDefinition(group, resource string) *resourceDefinition {
	for i := range resourceRegistry {
		r := &resourceRegistry[i]
		if r.groupResource.Group == group && r.groupResource.Resource == resource {
			return r
		}
	}
	return nil
}

func buildResourceKey(group, resource, namespace string) *resourcepb.ResourceKey {
	def := getResourceDefinition(group, resource)
	if def == nil {
		return nil
	}
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     def.groupResource.Group,
		Resource:  def.groupResource.Resource,
	}
}

func getMigratorFunc(accessor legacy.MigrationDashboardAccessor, group, resource string) migratorFunc {
	def := getResourceDefinition(group, resource)
	if def == nil {
		return nil
	}

	switch def.migratorFunc {
	case "MigrateFolders":
		return accessor.MigrateFolders
	case "MigrateLibraryPanels":
		return accessor.MigrateLibraryPanels
	case "MigrateDashboards":
		return accessor.MigrateDashboards
	case "MigratePlaylists":
		return accessor.MigratePlaylists
	default:
		return nil
	}
}

func validateRegisteredResources() error {
	registeredMap := make(map[string]bool)
	for _, gr := range resourceRegistry {
		key := fmt.Sprintf("%s.%s", gr.groupResource.Resource, gr.groupResource.Group)
		registeredMap[key] = true
	}

	var missing []string
	for expected := range setting.MigratedUnifiedResources {
		if !registeredMap[expected] {
			missing = append(missing, expected)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("resources declared in setting.MigratedUnifiedResources are not registered for migration: %v", missing)
	}

	return nil
}
