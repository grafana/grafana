package playlist

import (
	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

/*
PlaylistRegistrar registers the playlists migration with the unified storage
migration system. It lives in the playlist package so the playlist team owns
their migration definition, decoupled from the dashboard accessor.
*/
type PlaylistRegistrar struct {
	migrator legacy.PlaylistMigrator
}

func NewPlaylistRegistrar(migrator legacy.PlaylistMigrator) *PlaylistRegistrar {
	return &PlaylistRegistrar{migrator: migrator}
}

func (r *PlaylistRegistrar) RegisterMigrations(registry *migrations.MigrationRegistry) {
	playlistGR := schema.GroupResource{Group: playlists.APIGroup, Resource: "playlists"}

	registry.Register(migrations.MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: playlistGR, LockTable: "playlist"},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			playlistGR: r.migrator.MigratePlaylists,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(playlistGR, "playlist", "org_id = ?"),
		},
	})
}
