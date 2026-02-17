package migrations

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
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

func TestMigrationStatusReader_GetStorageMode_ConfigOnly(t *testing.T) {
	// These tests exercise config-based resolution (no DB).
	// The migration log path requires a real database and is covered by integration tests.

	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	unknownGR := schema.GroupResource{Resource: "unknown", Group: "unknown.grafana.app"}

	t.Run("Mode5 returns Unified", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(), // empty registry = no migration log path
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeUnified, mode)
	})

	t.Run("Mode4 returns Unified", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeUnified, mode)
	})

	t.Run("Mode1 returns DualWrite", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeDualWrite, mode)
	})

	t.Run("Mode2 returns DualWrite (backward compat)", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeDualWrite, mode)
	})

	t.Run("Mode3 returns DualWrite (backward compat)", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode3},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeDualWrite, mode)
	})

	t.Run("Mode0 returns Legacy", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode0},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})

	t.Run("resource not in config returns Legacy", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), unknownGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})

	t.Run("nil UnifiedStorage returns Legacy", func(t *testing.T) {
		cfg := &setting.Cfg{}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: NewMigrationRegistry(),
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})
}

func TestMigrationStatusReader_GetStorageMode_DualWritePriority(t *testing.T) {
	// Verify that Mode1 config takes priority even when a resource is registered
	// in the migration registry (but no DB to check migration log).
	// This simulates cloud holding a resource in DualWrite.

	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources:   []ResourceInfo{{GroupResource: playlistGR}},
	})

	t.Run("Mode1 takes priority over migration log lookup", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		reader := &migrationStatusReader{
			cfg:      cfg,
			registry: registry,
			// sqlStore is nil — if we reach the migration log check, it will panic.
			// The test verifies Mode1 short-circuits before that.
		}

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeDualWrite, mode)
	})
}

func TestStorageMode_String(t *testing.T) {
	require.Equal(t, "legacy", contract.StorageModeLegacy.String())
	require.Equal(t, "dual-write", contract.StorageModeDualWrite.String())
	require.Equal(t, "unified", contract.StorageModeUnified.String())
	require.Equal(t, "unknown", contract.StorageMode(99).String())
}
