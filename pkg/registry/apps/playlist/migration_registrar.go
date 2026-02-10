package playlist

import (
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/resources"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

/*
PlaylistMigration returns the migration definition for playlists.
It lives in the playlist package so the playlist team owns their migration
definition, using the central ResourceMigrationService.
*/
func PlaylistMigration(migrator resources.ResourceMigrationService) migrations.MigrationDefinition {
	playlistGR := schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"}

	return migrations.MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: playlistGR, LockTable: "playlist"},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			playlistGR: migrator.MigratePlaylists,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(playlistGR, "playlist", "org_id = ?"),
		},
	}
}
