package migrations

import (
	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

/*
BuildMigrationRegistry creates a migration registry with all migrations registered.
This function should be called from the wire factory where the accessor is available.

The registry is built with direct method references from the accessor, avoiding the need
for global state. Validator factories are stored and validators are created lazily when
the client and driver name become available during migration registration.
*/
func BuildMigrationRegistry(accessor legacy.MigrationDashboardAccessor) *MigrationRegistry {
	r := NewMigrationRegistry()

	folderGR := schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE}

	r.Register(MigrationDefinition{
		ID:          "folders-dashboards",
		MigrationID: "folders and dashboards migration",
		Resources: []ResourceInfo{
			{GroupResource: folderGR, LockTable: "folder"},
			{GroupResource: dashboardGR, LockTable: "dashboard"},
		},
		Migrators: map[schema.GroupResource]MigratorFunc{
			folderGR:    accessor.MigrateFolders,
			dashboardGR: accessor.MigrateDashboards,
		},
		Validators: []ValidatorFactory{
			CountValidation(folderGR, "dashboard", "org_id = ? AND is_folder = true AND deleted IS NULL"),
			CountValidation(dashboardGR, "dashboard", "org_id = ? AND is_folder = false AND deleted IS NULL"),
			FolderTreeValidation(folderGR),
		},
	})

	playlistGR := schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"}

	r.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []ResourceInfo{
			{GroupResource: playlistGR, LockTable: "playlist"},
		},
		Migrators: map[schema.GroupResource]MigratorFunc{
			playlistGR: accessor.MigratePlaylists,
		},
		Validators: []ValidatorFactory{
			CountValidation(playlistGR, "playlist", "org_id = ?"),
		},
	})

	shortUrlGR := schema.GroupResource{Group: shorturl.APIGroup, Resource: "shorturls"}

	r.Register(MigrationDefinition{
		ID:          "shorturls",
		MigrationID: "shorturls migration",
		Resources: []ResourceInfo{
			{GroupResource: shortUrlGR, LockTable: "short_url"},
		},
		Migrators: map[schema.GroupResource]MigratorFunc{
			shortUrlGR: accessor.MigrateShortURLs,
		},
		Validators: []ValidatorFactory{
			CountValidation(shortUrlGR, "short_url", "org_id = ?"),
		},
	})

	return r
}

// ProvideMigrationRegistry is a Wire provider function for the migration registry.
func ProvideMigrationRegistry(accessor legacy.MigrationDashboardAccessor) *MigrationRegistry {
	return BuildMigrationRegistry(accessor)
}
