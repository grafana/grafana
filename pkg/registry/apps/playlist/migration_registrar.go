package playlist

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	migrator "github.com/grafana/grafana/pkg/registry/apps/playlist/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func PlaylistMigration(migrator migrator.PlaylistMigrator) migrations.MigrationDefinition {
	playlistGR := schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"}

	return migrations.MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: playlistGR, LockTables: []string{"playlist", "playlist_item"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			playlistGR: migrator.MigratePlaylists,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(playlistGR, migrations.CountValidationOptions{
				Table: "playlist",
				Where: "org_id = ?",
			}),
		},
		SkipWhenMissing: true, // playlists may not exist at all
		RenameTables:    []string{},
	}
}
