package migrations

import (
	"fmt"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type ResourceDefinition struct {
	GroupResource schema.GroupResource
	MigratorFunc  string // Name of the method: "MigrateFolders", "MigrateDashboards", etc.
}

var registeredResources = []ResourceDefinition{
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

func getResourceDefinition(group, resource string) *ResourceDefinition {
	for i := range registeredResources {
		r := &registeredResources[i]
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
	for _, gr := range registeredResources {
		key := fmt.Sprintf("%s.%s", gr.GroupResource.Resource, gr.GroupResource.Group)
		registeredMap[key] = true
	}

	var missing []string
	for _, expected := range setting.MigratedUnifiedResources {
		if !registeredMap[expected] {
			missing = append(missing, expected)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("resources declared in setting.MigratedUnifiedResources are not registered for migration: %v", missing)
	}

	return nil
}
