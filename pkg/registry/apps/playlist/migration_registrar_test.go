package playlist

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/require"
)

func TestPlaylistRegistrar(t *testing.T) {
	t.Run("registers playlists migration", func(t *testing.T) {
		plMigrator := &mockPlaylistMigrator{}
		registrar := NewPlaylistRegistrar(plMigrator)
		registry := migrations.NewMigrationRegistry()

		registrar.RegisterMigrations(registry)

		def, ok := registry.Get("playlists")
		require.True(t, ok)
		require.Len(t, def.Resources, 1)
		require.Len(t, def.Migrators, 1)
		require.Len(t, def.Validators, 1)
	})
}

type mockPlaylistMigrator struct{}

func (m *mockPlaylistMigrator) MigratePlaylists(_ context.Context, _ int64, _ legacy.MigrateOptions, _ resourcepb.BulkStore_BulkProcessClient) error {
	return nil
}
