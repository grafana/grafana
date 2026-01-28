package migrations

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func registerMigrations(ctx context.Context,
	cfg *setting.Cfg,
	mg *sqlstoremigrator.Migrator,
	migrator UnifiedMigrator,
	client resource.ResourceClient,
	sqlStore db.DB,
) error {
	for _, def := range Registry.All() {
		if shouldAutoMigrate(ctx, def, cfg, sqlStore) {
			registerMigration(mg, migrator, client, def, WithAutoMigrate(cfg))
			continue
		}

		enabled, err := isMigrationEnabled(def, cfg)
		if err != nil {
			return err
		}
		if !enabled {
			logger.Info("Migration is disabled in config, skipping", "migration", def.ID)
			continue
		}
		registerMigration(mg, migrator, client, def)
	}
	return nil
}

func registerMigration(mg *sqlstoremigrator.Migrator,
	migrator UnifiedMigrator,
	client resource.ResourceClient,
	def MigrationDefinition,
	opts ...ResourceMigrationOption,
) {
	validators := def.CreateValidators(client, mg.Dialect.DriverName())
	migration := NewResourceMigration(migrator, def.Resources, def.ID, validators, opts...)
	mg.AddMigration(def.MigrationID, migration)
}

// TODO: remove this before Grafana 13 GA: https://github.com/grafana/search-and-storage-team/issues/613
func shouldAutoMigrate(ctx context.Context, def MigrationDefinition, cfg *setting.Cfg, sqlStore db.DB) bool {
	autoMigrate := false
	configResources := def.ConfigResources()

	for _, res := range configResources {
		config := cfg.UnifiedStorageConfig(res)

		if config.DualWriterMode == 5 {
			return false
		}

		if !setting.AutoMigratedUnifiedResources[res] {
			continue
		}

		if checkIfAlreadyMigrated(ctx, def, sqlStore) {
			for _, res := range configResources {
				cfg.EnableMode5(res)
			}
			logger.Info("Auto-migration already completed, enabling mode 5 for resources", "migration", def.ID)
			return true
		}

		autoMigrate = true
		threshold := int64(setting.DefaultAutoMigrationThreshold)
		if config.AutoMigrationThreshold > 0 {
			threshold = int64(config.AutoMigrationThreshold)
		}

		count, err := countResource(ctx, sqlStore, res)
		if err != nil {
			logger.Warn("Failed to count resource for auto migration check", "resource", res, "error", err)
			return false
		}

		logger.Info("Resource count for auto migration check", "resource", res, "count", count, "threshold", threshold)

		if count > threshold {
			return false
		}
	}

	if !autoMigrate {
		return false
	}

	logger.Info("Auto-migration enabled for migration", "migration", def.ID)
	return true
}

func checkIfAlreadyMigrated(ctx context.Context, def MigrationDefinition, sqlStore db.DB) bool {
	if def.MigrationID == "" {
		return false
	}

	exists, err := migrationExists(ctx, sqlStore, def.MigrationID)
	if err != nil {
		logger.Warn("Failed to check if migration exists", "migration", def.ID, "error", err)
		return false
	}

	return exists
}

func isMigrationEnabled(def MigrationDefinition, cfg *setting.Cfg) (bool, error) {
	var (
		hasValue   bool
		allEnabled bool
	)
	configResources := def.ConfigResources()

	for _, res := range configResources {
		enabled := cfg.UnifiedStorage[res].EnableMigration
		if !hasValue {
			allEnabled = enabled
			hasValue = true
			continue
		}
		if enabled != allEnabled {
			return false, fmt.Errorf("cannot migrate resources separately: %v migration must be either all enabled or all disabled", configResources)
		}
	}

	return allEnabled, nil
}

// TODO: remove this before Grafana 13 GA: https://github.com/grafana/search-and-storage-team/issues/613
func countResource(ctx context.Context, sqlStore db.DB, resourceName string) (int64, error) {
	var count int64
	err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		switch resourceName {
		case setting.DashboardResource:
			count, err = sess.Table("dashboard").Where("is_folder = ? AND deleted IS NULL", false).Count()
		case setting.FolderResource:
			count, err = sess.Table("dashboard").Where("is_folder = ? AND deleted IS NULL", true).Count()
		default:
			return fmt.Errorf("unknown resource: %s", resourceName)
		}
		return err
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

func buildResourceKey(gr schema.GroupResource, namespace string) *resourcepb.ResourceKey {
	if !Registry.HasResource(gr) {
		return nil
	}
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     gr.Group,
		Resource:  gr.Resource,
	}
}

func validateRegisteredResources() error {
	var missing []string
	for expected := range setting.MigratedUnifiedResources {
		// Parse the expected format "resource.group" into a GroupResource
		gr := parseConfigResource(expected)
		if !Registry.HasResource(gr) {
			missing = append(missing, expected)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("resources declared in setting.MigratedUnifiedResources are not registered for migration: %v", missing)
	}

	return nil
}

// parseConfigResource parses a config resource string "resource.group" into a GroupResource.
func parseConfigResource(configResource string) schema.GroupResource {
	// Format is "resource.group" e.g. "dashboards.dashboard.grafana.app"
	// Find the first dot to split resource from group
	resource, group, found := strings.Cut(configResource, ".")
	if !found {
		return schema.GroupResource{Resource: configResource}
	}
	return schema.GroupResource{
		Resource: resource,
		Group:    group,
	}
}
