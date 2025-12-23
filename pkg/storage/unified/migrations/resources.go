package migrations

import (
	"fmt"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type ResourceDefinition struct {
	GroupResource schema.GroupResource
	MigratorFunc  string // Name of the method: "MigrateFolders", "MigrateDashboards", etc.
}

type migrationDefinition struct {
	name         string
	resources    []string
	registerFunc func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient)
}

var resourceRegistry = []ResourceDefinition{
	{
		GroupResource: schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE},
		MigratorFunc:  "MigrateFolders",
	},
	{
		GroupResource: schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.LIBRARY_PANEL_RESOURCE},
		MigratorFunc:  "MigrateLibraryPanels",
	},
	{
		GroupResource: schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE},
		MigratorFunc:  "MigrateDashboards",
	},
	{
		GroupResource: schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"},
		MigratorFunc:  "MigratePlaylists",
	},
}

var migrationRegistry = []migrationDefinition{
	{
		name:         "playlists",
		resources:    []string{setting.PlaylistResource},
		registerFunc: registerPlaylistMigration,
	},
	{
		name:         "folders and dashboards",
		resources:    []string{setting.FolderResource, setting.DashboardResource},
		registerFunc: registerDashboardAndFolderMigration,
	},
}

func registerMigrations(cfg *setting.Cfg, mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) error {
	for _, migration := range migrationRegistry {
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
				return fmt.Errorf("cannot migrate resources separately: %v migration must be either all enabled or all disabled", migration.resources)
			}
		}

		if !allEnabled {
			logger.Info("Migration is disabled in config, skipping", "migration", migration.name)
			continue
		}
		migration.registerFunc(mg, migrator, client)
	}
	return nil
}

func getResourceDefinition(group, resource string) *ResourceDefinition {
	for i := range resourceRegistry {
		r := &resourceRegistry[i]
		if r.GroupResource.Group == group && r.GroupResource.Resource == resource {
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
		Group:     def.GroupResource.Group,
		Resource:  def.GroupResource.Resource,
	}
}

func getMigratorFunc(accessor legacy.MigrationDashboardAccessor, group, resource string) migratorFunc {
	def := getResourceDefinition(group, resource)
	if def == nil {
		return nil
	}

	switch def.MigratorFunc {
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
		key := fmt.Sprintf("%s.%s", gr.GroupResource.Resource, gr.GroupResource.Group)
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
