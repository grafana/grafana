package migrations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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

	reader := newTestStatusReader(t, &setting.Cfg{}, registry)

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

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
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})

	t.Run("resource not in config returns Legacy", func(t *testing.T) {
		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{},
		}
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

		mode, err := reader.GetStorageMode(context.Background(), unknownGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})

	t.Run("nil UnifiedStorage returns Legacy", func(t *testing.T) {
		cfg := &setting.Cfg{}
		reader := newTestStatusReader(t, cfg, NewMigrationRegistry())

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeLegacy, mode)
	})
}

func TestMigrationStatusReader_GetStorageMode_DualWritePriority(t *testing.T) {
	// Verify that Mode1 config takes priority when a resource is registered
	// but the migration log table is not available yet.

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
		reader := newTestStatusReader(t, cfg, registry)

		mode, err := reader.GetStorageMode(context.Background(), playlistGR)
		require.NoError(t, err)
		require.Equal(t, contract.StorageModeDualWrite, mode)
	})
}

func TestProvideMigrationStatusReader_UsesConfigWhenTableIsMissing(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *infraDB.Session) error {
		_, err := sess.Exec("DROP TABLE IF EXISTS " + migrationLogTableName)
		return err
	}))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode5},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, newPlaylistRegistry())
	require.NoError(t, err)

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode)
}

func TestMigrationStatusReader_GetStorageMode_MigrationLogOverridesMode1Immediately(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry)
	require.NoError(t, err)

	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", true, ""))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode)
}

func TestMigrationStatusReader_GetStorageMode_RechecksTableAvailabilityAfterStartup(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *infraDB.Session) error {
		_, err := sess.Exec("DROP TABLE IF EXISTS " + migrationLogTableName)
		return err
	}))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry)
	require.NoError(t, err)

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))
	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", true, ""))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode)
}

func TestMigrationStatusReader_GetStorageMode_IgnoresMigrationLogRowsWithError(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry)
	require.NoError(t, err)

	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", false, "boom"))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeDualWrite, mode)
}

func TestProvideMigrationStatusReader_FailsWhenStartupMigrationLogLoadFails(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	reader, err := ProvideMigrationStatusReader(&failingMigrationStatusDB{
		DB:   sqlStore,
		fail: true,
	}, cfg, newPlaylistRegistry())
	require.Nil(t, reader)
	require.ErrorContains(t, err, "failed to load migration log rows")
}

func TestMigrationStatusReader_GetStorageMode_FailsWhenRuntimeMigrationLookupFails(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	failingDB := &failingMigrationStatusDB{DB: sqlStore}
	reader, err := ProvideMigrationStatusReader(failingDB, cfg, registry)
	require.NoError(t, err)

	failingDB.fail = true
	_, err = reader.GetStorageMode(context.Background(), playlistGR)
	require.ErrorContains(t, err, "failed to resolve storage mode")
}

func newPlaylistRegistry() *MigrationRegistry {
	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources: []ResourceInfo{
			{GroupResource: schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}},
		},
	})
	return registry
}

func newTestStatusReader(t *testing.T, cfg *setting.Cfg, registry *MigrationRegistry) *migrationStatusReader {
	t.Helper()

	sqlStore, _ := infraDB.InitTestDBWithCfg(t)
	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry)
	require.NoError(t, err)

	typed, ok := reader.(*migrationStatusReader)
	require.True(t, ok)
	return typed
}

func insertMigrationLogRow(sqlStore infraDB.DB, migrationID string, success bool, migrationError string) error {
	return sqlStore.WithDbSession(context.Background(), func(sess *infraDB.Session) error {
		_, err := sess.Exec(
			"INSERT INTO "+migrationLogTableName+" (migration_id, sql, success, error, timestamp) VALUES (?, ?, ?, ?, ?)",
			migrationID,
			"test",
			success,
			migrationError,
			time.Now(),
		)
		return err
	})
}

type failingMigrationStatusDB struct {
	infraDB.DB
	fail bool
}

func (f *failingMigrationStatusDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	if f.fail {
		return errors.New("boom")
	}
	return f.DB.WithDbSession(ctx, callback)
}

func TestStorageMode_String(t *testing.T) {
	require.Equal(t, "legacy", contract.StorageModeLegacy.String())
	require.Equal(t, "dual-write", contract.StorageModeDualWrite.String())
	require.Equal(t, "unified", contract.StorageModeUnified.String())
	require.Equal(t, "unknown", contract.StorageMode(99).String())
}
