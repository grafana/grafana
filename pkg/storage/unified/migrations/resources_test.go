package migrations

import (
	"testing"

	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestIsMigrationEnabled tests the isMigrationEnabled function directly
func TestIsMigrationEnabled(t *testing.T) {
	const (
		fakePlaylistResource  = "fake.playlists.resource"
		fakeFolderResource    = "fake.folders.resource"
		fakeDashboardResource = "fake.dashboards.resource"
	)

	// Create fake GroupResources that map to our fake config resources
	playlistGR := schema.GroupResource{Resource: "fake", Group: "playlists.resource"}
	folderGR := schema.GroupResource{Resource: "fake", Group: "folders.resource"}
	dashboardGR := schema.GroupResource{Resource: "fake", Group: "dashboards.resource"}

	playlistDef := MigrationDefinition{
		ID:          "test-playlists",
		MigrationID: "playlists migration",
		Resources:   []ResourceInfo{{GroupResource: playlistGR}},
	}
	foldersDashboardsDef := MigrationDefinition{
		ID:          "test-folders-dashboards",
		MigrationID: "folders and dashboards migration",
		Resources:   []ResourceInfo{{GroupResource: folderGR}, {GroupResource: dashboardGR}},
	}

	// Build a minimal cfg with UnifiedStorage entries
	makeCfg := func(vals map[string]bool) *setting.Cfg {
		cfg := &setting.Cfg{UnifiedStorage: make(map[string]setting.UnifiedStorageConfig)}
		for k, v := range vals {
			cfg.UnifiedStorage[k] = setting.UnifiedStorageConfig{
				EnableMigration: v,
			}
		}
		return cfg
	}

	// Table of scenarios
	tests := []struct {
		name            string
		def             MigrationDefinition
		enablePlaylist  bool
		enableFolder    bool
		enableDashboard bool
		wantEnabled     bool
		wantErr         bool
	}{
		{name: "playlists enabled", def: playlistDef, enablePlaylist: true, wantEnabled: true},
		{name: "playlists disabled", def: playlistDef, enablePlaylist: false, wantEnabled: false},
		{name: "folders+dashboards both enabled", def: foldersDashboardsDef, enableFolder: true, enableDashboard: true, wantEnabled: true},
		{name: "folders enabled, dashboards disabled (mismatch)", def: foldersDashboardsDef, enableFolder: true, enableDashboard: false, wantErr: true},
		{name: "folders disabled, dashboards enabled (mismatch)", def: foldersDashboardsDef, enableFolder: false, enableDashboard: true, wantErr: true},
		{name: "folders+dashboards both disabled", def: foldersDashboardsDef, enableFolder: false, enableDashboard: false, wantEnabled: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := makeCfg(map[string]bool{
				fakePlaylistResource:  tt.enablePlaylist,
				fakeFolderResource:    tt.enableFolder,
				fakeDashboardResource: tt.enableDashboard,
			})

			enabled, err := isMigrationEnabled(tt.def, cfg)

			if tt.wantErr {
				require.Error(t, err, "expected error for mismatched enablement")
			} else {
				require.NoError(t, err, "unexpected error")
				require.Equal(t, tt.wantEnabled, enabled, "enabled mismatch")
			}
		})
	}
}

// TestRegisterMigrations exercises registerMigrations with various EnableMigration configs using a table-driven test.
func TestRegisterMigrations(t *testing.T) {
	const (
		fakePlaylistResource  = "fake.playlists.resource"
		fakeFolderResource    = "fake.folders.resource"
		fakeDashboardResource = "fake.dashboards.resource"
	)

	// helper to build a fake registry with test migration definitions
	setupFakeRegistry := func() *MigrationRegistry {
		registry := NewMigrationRegistry()

		// Create fake GroupResources that map to our fake config resources
		playlistGR := schema.GroupResource{Resource: "fake", Group: "playlists.resource"}
		folderGR := schema.GroupResource{Resource: "fake", Group: "folders.resource"}
		dashboardGR := schema.GroupResource{Resource: "fake", Group: "dashboards.resource"}

		registry.Register(MigrationDefinition{
			ID:          "test-playlists",
			MigrationID: "playlists migration",
			Resources:   []ResourceInfo{{GroupResource: playlistGR}},
		})
		registry.Register(MigrationDefinition{
			ID:          "test-folders-dashboards",
			MigrationID: "folders and dashboards migration",
			Resources:   []ResourceInfo{{GroupResource: folderGR}, {GroupResource: dashboardGR}},
		})
		return registry
	}

	// Build a minimal cfg with UnifiedStorage entries used by registerMigrations
	makeCfg := func(vals map[string]bool) *setting.Cfg {
		cfg := &setting.Cfg{UnifiedStorage: make(map[string]setting.UnifiedStorageConfig)}
		for k, v := range vals {
			cfg.UnifiedStorage[k] = setting.UnifiedStorageConfig{
				EnableMigration: v,
			}
		}
		return cfg
	}

	// Helper to run registerMigrations and capture the registered migration IDs
	runAndGetMigrationIDs := func(cfg *setting.Cfg, registry *MigrationRegistry) ([]string, error) {
		var ids []string
		var capturedErr error
		_ = sqlstoremigrator.CheckExpectedMigrations(sqlstoremigrator.SQLite,
			[]sqlstoremigrator.ExpectedMigration{},
			func(mg *sqlstoremigrator.Migrator) {
				capturedErr = registerMigrations(cfg, mg, nil, nil, registry)
				ids = mg.GetMigrationIDs(false)
			})
		return ids, capturedErr
	}

	t.Run("playlists enabled registers migration", func(t *testing.T) {
		registry := setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  true,
			fakeFolderResource:    false,
			fakeDashboardResource: false,
		})

		ids, err := runAndGetMigrationIDs(cfg, registry)
		require.NoError(t, err)
		require.Contains(t, ids, "playlists migration")
		require.NotContains(t, ids, "folders and dashboards migration")
	})

	t.Run("folders+dashboards both enabled registers migration", func(t *testing.T) {
		registry := setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    true,
			fakeDashboardResource: true,
		})

		ids, err := runAndGetMigrationIDs(cfg, registry)
		require.NoError(t, err)
		require.Contains(t, ids, "folders and dashboards migration")
		require.NotContains(t, ids, "playlists migration")
	})

	t.Run("mismatched enablement returns error", func(t *testing.T) {
		registry := setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    true,
			fakeDashboardResource: false,
		})

		_, err := runAndGetMigrationIDs(cfg, registry)
		require.Error(t, err, "expected error for mismatched enablement")
	})

	t.Run("all disabled registers nothing", func(t *testing.T) {
		registry := setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    false,
			fakeDashboardResource: false,
		})

		ids, err := runAndGetMigrationIDs(cfg, registry)
		require.NoError(t, err)
		require.Empty(t, ids)
	})
}

// TestResourceMigration_SkipMigrationLog verifies migration log writing is always enabled.
func TestResourceMigration_SkipMigrationLog(t *testing.T) {
	m := &ResourceMigration{}
	require.False(t, m.SkipMigrationLog())
}
