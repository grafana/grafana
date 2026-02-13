package migrations

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestMigrationStatusReader_FindDefinition(t *testing.T) {
	folderGR := schema.GroupResource{Resource: "folders", Group: "folder.grafana.app"}
	dashboardGR := schema.GroupResource{Resource: "dashboards", Group: "dashboard.grafana.app"}
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	unknownGR := schema.GroupResource{Resource: "unknown", Group: "unknown.grafana.app"}

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "folders-dashboards",
		MigrationID: "folders and dashboards migration",
		Resources: []ResourceInfo{
			{GroupResource: folderGR},
			{GroupResource: dashboardGR},
		},
	})
	registry.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []ResourceInfo{
			{GroupResource: playlistGR},
		},
	})

	reader := &migrationStatusReader{registry: registry}

	t.Run("finds definition for folder resource", func(t *testing.T) {
		def, ok := reader.findDefinition(folderGR)
		require.True(t, ok)
		require.Equal(t, "folders-dashboards", def.ID)
	})

	t.Run("finds definition for dashboard resource", func(t *testing.T) {
		def, ok := reader.findDefinition(dashboardGR)
		require.True(t, ok)
		require.Equal(t, "folders-dashboards", def.ID)
	})

	t.Run("finds definition for playlist resource", func(t *testing.T) {
		def, ok := reader.findDefinition(playlistGR)
		require.True(t, ok)
		require.Equal(t, "playlists", def.ID)
	})

	t.Run("returns false for unknown resource", func(t *testing.T) {
		_, ok := reader.findDefinition(unknownGR)
		require.False(t, ok)
	})
}

func TestMigrationStatusReader_IsMigrated_ConfigFallback(t *testing.T) {
	// This test only exercises the config fallback path (no DB).
	// The migration log path requires a real database and is covered by integration tests.

	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	unknownGR := schema.GroupResource{Resource: "unknown", Group: "unknown.grafana.app"}

	t.Run("returns true when config says Mode5", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(), // empty registry = no migration log entries
		}

		migrated, err := reader.IsMigrated(context.Background(), playlistGR)
		require.NoError(t, err)
		require.True(t, migrated)
	})

	t.Run("returns true when config says Mode4", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		migrated, err := reader.IsMigrated(context.Background(), playlistGR)
		require.NoError(t, err)
		require.True(t, migrated)
	})

	t.Run("returns false when config says Mode2", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		migrated, err := reader.IsMigrated(context.Background(), playlistGR)
		require.NoError(t, err)
		require.False(t, migrated)
	})

	t.Run("returns false when resource not in config", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		migrated, err := reader.IsMigrated(context.Background(), unknownGR)
		require.NoError(t, err)
		require.False(t, migrated)
	})

	t.Run("returns false when config is nil", func(t *testing.T) {
		cfg := &setting.Cfg{}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		migrated, err := reader.IsMigrated(context.Background(), playlistGR)
		require.NoError(t, err)
		require.False(t, migrated)
	})
}
