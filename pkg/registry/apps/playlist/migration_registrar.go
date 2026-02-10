package playlist

import (
	"context"

	playlists "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type PlaylistMigrator interface {
	MigratePlaylists(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

/*
PlaylistMigration returns the migration definition for playlists.
It lives in the playlist package so the playlist team owns their migration
definition and migration logic.
*/
func PlaylistMigration(migrator PlaylistMigrator) migrations.MigrationDefinition {
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
