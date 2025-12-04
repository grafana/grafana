package migrations

import (
	"fmt"

	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type ResourceDefinition struct {
	GroupResource schema.GroupResource
	KeyGroup      string
	KeyResource   string
	MigratorFunc  string // Name of the method: "MigrateFolders", "MigrateDashboards", etc.
}

var registeredResources = []ResourceDefinition{
	{
		GroupResource: schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"},
		KeyGroup:      folders.GROUP,
		KeyResource:   folders.RESOURCE,
		MigratorFunc:  "MigrateFolders",
	},
	{
		GroupResource: schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		KeyGroup:      v1beta1.GROUP,
		KeyResource:   v1beta1.LIBRARY_PANEL_RESOURCE,
		MigratorFunc:  "MigrateLibraryPanels",
	},
	{
		GroupResource: schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"},
		KeyGroup:      v1beta1.GROUP,
		KeyResource:   v1beta1.DASHBOARD_RESOURCE,
		MigratorFunc:  "MigrateDashboards",
	},
	{
		GroupResource: schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"},
		KeyGroup:      "playlist.grafana.app", // no constant defined
		KeyResource:   "playlists",            // no constant defined
		MigratorFunc:  "MigratePlaylists",
	},
}

func GetResources() []schema.GroupResource {
	result := make([]schema.GroupResource, len(registeredResources))
	for i, r := range registeredResources {
		result[i] = r.GroupResource
	}
	return result
}

func GetResourceDefinition(group, resource string) *ResourceDefinition {
	for i := range registeredResources {
		r := &registeredResources[i]
		if r.GroupResource.Group == group && r.GroupResource.Resource == resource {
			return r
		}
	}
	return nil
}

func BuildResourceKey(group, resource, namespace string) *resourcepb.ResourceKey {
	def := GetResourceDefinition(group, resource)
	if def == nil {
		return nil
	}
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     def.KeyGroup,
		Resource:  def.KeyResource,
	}
}

func GetMigratorFunc(accessor legacy.MigrationDashboardAccessor, group, resource string) migratorFunc {
	def := GetResourceDefinition(group, resource)
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

func ValidateRegisteredResources() error {
	registeredMap := make(map[string]bool)
	for _, gr := range GetResources() {
		key := fmt.Sprintf("%s.%s", gr.Resource, gr.Group)
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
