package migrations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

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

	tests := []struct {
		name      string
		gr        schema.GroupResource
		wantID    string
		wantFound bool
	}{
		{name: "resource in multi-resource definition", gr: folderGR, wantID: "folders-dashboards", wantFound: true},
		{name: "second resource in same definition", gr: dashboardGR, wantID: "folders-dashboards", wantFound: true},
		{name: "resource in single-resource definition", gr: playlistGR, wantID: "playlists", wantFound: true},
		{name: "unregistered resource", gr: unknownGR, wantFound: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			def, ok := reader.findDefinition(tt.gr)
			require.Equal(t, tt.wantFound, ok)
			if tt.wantFound {
				require.Equal(t, tt.wantID, def.ID)
			}
		})
	}
}

func TestMigrationStatusReader_GetFloorVersion(t *testing.T) {
	staticGR := schema.GroupResource{Resource: "preferences", Group: "preferences.grafana.app"}
	floorGR := schema.GroupResource{Resource: "dashboards", Group: "dashboard.grafana.app"}
	emptyGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	unknownGR := schema.GroupResource{Resource: "unknown", Group: "unknown.grafana.app"}
	// datasource migration registers a single primary group; dual writing addresses
	// each plugin under its own subgroup (e.g. "prometheus.datasource.grafana.app").
	dsGR := schema.GroupResource{Resource: "datasources", Group: "datasource.grafana.app"}
	dsPluginGR := schema.GroupResource{Resource: "datasources", Group: "prometheus.datasource.grafana.app"}
	dsWrongResourceGR := schema.GroupResource{Resource: "other", Group: "prometheus.datasource.grafana.app"}

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "preferences",
		MigrationID: "preferences migration",
		Resources:   []ResourceInfo{{GroupResource: staticGR, FloorVersion: "v1"}},
	})
	registry.Register(MigrationDefinition{
		ID:          "dashboards",
		MigrationID: "dashboards migration",
		Resources:   []ResourceInfo{{GroupResource: floorGR, FloorVersion: "v0alpha1"}},
	})
	registry.Register(MigrationDefinition{
		ID:          "playlists",
		MigrationID: "playlists migration",
		Resources:   []ResourceInfo{{GroupResource: emptyGR}},
	})
	registry.Register(MigrationDefinition{
		ID:          "datasources",
		MigrationID: "datasources migration",
		Resources:   []ResourceInfo{{GroupResource: dsGR, FloorVersion: "v0alpha1"}},
	})

	reader := newTestStatusReader(t, &setting.Cfg{}, registry)

	tests := []struct {
		name        string
		gr          schema.GroupResource
		wantVersion string
		wantOK      bool
	}{
		{name: "static version returned", gr: staticGR, wantVersion: "v1", wantOK: true},
		{name: "floor version returned", gr: floorGR, wantVersion: "v0alpha1", wantOK: true},
		{name: "empty floor version skipped", gr: emptyGR, wantOK: false},
		{name: "unregistered resource skipped", gr: unknownGR, wantOK: false},
		{name: "primary datasource group returned", gr: dsGR, wantVersion: "v0alpha1", wantOK: true},
		{name: "plugin datasource subgroup returned", gr: dsPluginGR, wantVersion: "v0alpha1", wantOK: true},
		{name: "plugin subgroup with mismatched resource skipped", gr: dsWrongResourceGR, wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			version, ok := reader.GetFloorVersion(tt.gr)
			require.Equal(t, tt.wantOK, ok)
			require.Equal(t, tt.wantVersion, version)
		})
	}
}

func TestMigrationStatusReader_GetStorageMode_ConfigResolution(t *testing.T) {
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	unknownGR := schema.GroupResource{Resource: "unknown", Group: "unknown.grafana.app"}
	configKey := "playlists.playlist.grafana.app"

	tests := []struct {
		name     string
		gr       schema.GroupResource
		cfg      *setting.Cfg
		wantMode contract.StorageMode
	}{
		{
			name:     "Mode0 returns Legacy",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode0),
			wantMode: contract.StorageModeLegacy,
		},
		{
			name:     "Mode1 returns DualWrite",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode1),
			wantMode: contract.StorageModeDualWrite,
		},
		{
			name:     "Mode2 returns DualWrite (backward compat)",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode2),
			wantMode: contract.StorageModeDualWrite,
		},
		{
			name:     "Mode3 returns DualWrite (backward compat)",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode3),
			wantMode: contract.StorageModeDualWrite,
		},
		{
			name:     "Mode4 returns Unified",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode4),
			wantMode: contract.StorageModeUnified,
		},
		{
			name:     "Mode5 returns Unified",
			gr:       playlistGR,
			cfg:      cfgWithMode(configKey, rest.Mode5),
			wantMode: contract.StorageModeUnified,
		},
		{
			name:     "resource not in config returns Legacy",
			gr:       unknownGR,
			cfg:      &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{}},
			wantMode: contract.StorageModeLegacy,
		},
		{
			name:     "nil UnifiedStorage returns Legacy",
			gr:       playlistGR,
			cfg:      &setting.Cfg{},
			wantMode: contract.StorageModeLegacy,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := newTestStatusReader(t, tt.cfg, NewMigrationRegistry())

			mode, err := reader.GetStorageMode(context.Background(), tt.gr)
			require.NoError(t, err)
			require.Equal(t, tt.wantMode, mode)
		})
	}
}

func TestMigrationStatusReader_GetStorageMode_MigrationLogOverridesConfig(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry, prometheus.NewRegistry())
	require.NoError(t, err)

	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", true, ""))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode)
}

func TestMigrationStatusReader_GetStorageMode_IgnoresFailedMigrationLogRows(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, registry, prometheus.NewRegistry())
	require.NoError(t, err)

	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", false, "boom"))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeDualWrite, mode)
}

func TestMigrationStatusReader_GetStorageMode_ConfigFallbackWhenLogMissing(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode5},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, newPlaylistRegistry(), prometheus.NewRegistry())
	require.NoError(t, err)

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode)
}

func TestMigrationStatusReader_OnlyCfgRecoveryWhenTableAppears(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, newPlaylistRegistry(), prometheus.NewRegistry())
	require.NoError(t, err)

	typed := reader.(*migrationStatusReader)

	// Simulate bootstrap failure.
	typed.onlyCfg.Store(true)

	// Insert a successful migration log row. Since the table exists, the retry in
	// resolveStorageMode should detect it, clear onlyCfg, and read the log.
	require.NoError(t, insertMigrationLogRow(sqlStore, "playlists migration", true, ""))

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeUnified, mode, "should recover and use migration log")
	require.False(t, typed.onlyCfg.Load(), "onlyCfg should be cleared after table is found")
}

func TestMigrationStatusReader_OnlyCfgPersistsWhenTableMissing(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, newPlaylistRegistry(), prometheus.NewRegistry())
	require.NoError(t, err)

	typed := reader.(*migrationStatusReader)

	// Drop the table and set onlyCfg to simulate a real bootstrap failure.
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *infraDB.Session) error {
		_, err := sess.Exec("DROP TABLE IF EXISTS " + migrationLogTableName)
		return err
	}))
	typed.onlyCfg.Store(true)

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeDualWrite, mode, "should use config when table is missing")
	require.True(t, typed.onlyCfg.Load(), "onlyCfg should remain set when table is still missing")
}

func TestMigrationStatusReader_GetStorageMode_DBErrorFallsBackToConfig(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}
	registry := newPlaylistRegistry()

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	failingDB := &failingMigrationStatusDB{DB: sqlStore}
	bootstrapCounter := newTestCounter("test_bootstrap_failures_db_error")

	reader, err := ProvideMigrationStatusReader(failingDB, cfg, registry, prometheus.NewRegistry())
	require.NoError(t, err)

	typed := reader.(*migrationStatusReader)
	require.False(t, typed.onlyCfg.Load(), "onlyCfg should not be set when bootstrap succeeds")
	typed.metrics = &statusReaderMetrics{bootstrapFailures: bootstrapCounter}

	failingDB.fail = true
	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.Error(t, err)
	require.Equal(t, contract.StorageModeDualWrite, mode)

	// Bootstrap counter should not increment on runtime DB errors.
	require.Equal(t, float64(0), testutil.ToFloat64(bootstrapCounter))
}

func TestMigrationStatusReader_GetStorageMode_NoErrorWhenBootstrapSucceeds(t *testing.T) {
	sqlStore, cfg := infraDB.InitTestDBWithCfg(t)
	playlistGR := schema.GroupResource{Resource: "playlists", Group: "playlist.grafana.app"}

	require.NoError(t, EnsureMigrationLogTable(context.Background(), sqlStore, cfg))

	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"playlists.playlist.grafana.app": {DualWriterMode: rest.Mode1},
	}

	bootstrapCounter := newTestCounter("test_bootstrap_no_error")
	reader, err := ProvideMigrationStatusReader(sqlStore, cfg, newPlaylistRegistry(), prometheus.NewRegistry())
	require.NoError(t, err)

	typed := reader.(*migrationStatusReader)
	require.False(t, typed.onlyCfg.Load())
	typed.metrics = &statusReaderMetrics{bootstrapFailures: bootstrapCounter}

	mode, err := reader.GetStorageMode(context.Background(), playlistGR)
	require.NoError(t, err)
	require.Equal(t, contract.StorageModeDualWrite, mode)
	require.Equal(t, float64(0), testutil.ToFloat64(bootstrapCounter))
}

func newTestCounter(name string) prometheus.Counter {
	return prometheus.NewCounter(prometheus.CounterOpts{Name: name})
}

func cfgWithMode(key string, mode rest.DualWriterMode) *setting.Cfg {
	return &setting.Cfg{
		UnifiedStorage: map[string]setting.UnifiedStorageConfig{
			key: {DualWriterMode: mode},
		},
	}
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

	sqlStore, testCfg := infraDB.InitTestDBWithCfg(t)
	testCfg.UnifiedStorage = cfg.UnifiedStorage
	testCfg.StorageModeCacheTTL = cfg.StorageModeCacheTTL
	reader, err := ProvideMigrationStatusReader(sqlStore, testCfg, registry, prometheus.NewRegistry())
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
