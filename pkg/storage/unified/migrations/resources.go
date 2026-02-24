package migrations

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func registerMigrations(cfg *setting.Cfg,
	mg *sqlstoremigrator.Migrator,
	migrator UnifiedMigrator,
	client resourcepb.ResourceIndexClient,
	registry *MigrationRegistry,
) error {
	for _, def := range registry.All() {
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
	client resourcepb.ResourceIndexClient,
	def MigrationDefinition,
	opts ...ResourceMigrationOption,
) {
	validators := def.CreateValidators(client, mg.Dialect.DriverName())
	migration := NewResourceMigration(migrator, def.GetGroupResources(), def.ID, validators, opts...)
	mg.AddMigration(def.MigrationID, migration)
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

func buildResourceKey(gr schema.GroupResource, namespace string, registry *MigrationRegistry) *resourcepb.ResourceKey {
	if !registry.HasResource(gr) {
		return nil
	}
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     gr.Group,
		Resource:  gr.Resource,
	}
}

func validateRegisteredResources(registry *MigrationRegistry) error {
	var missing []string
	for expected := range setting.MigratedUnifiedResources {
		gr := parseConfigResource(expected)
		if !registry.HasResource(gr) {
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
