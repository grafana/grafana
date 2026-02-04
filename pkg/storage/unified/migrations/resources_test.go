package migrations

import (
	"context"
	"strings"
	"testing"

	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestIsMigrationEnabled tests the isMigrationEnabled function directly
func TestIsMigrationEnabled(t *testing.T) {
	// Use fake resource names that are NOT in setting.AutoMigratedUnifiedResources
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
	// Save original registry and restore after test
	origDefinitions := Registry.definitions
	origOrder := Registry.order
	t.Cleanup(func() {
		Registry.definitions = origDefinitions
		Registry.order = origOrder
	})

	// Use fake resource names that are NOT in setting.AutoMigratedUnifiedResources
	// to avoid triggering the auto-migrate code path which requires a non-nil sqlStore.
	const (
		fakePlaylistResource  = "fake.playlists.resource"
		fakeFolderResource    = "fake.folders.resource"
		fakeDashboardResource = "fake.dashboards.resource"
	)

	// helper to build a fake registry with test migration definitions
	setupFakeRegistry := func() {
		Registry.definitions = make(map[string]MigrationDefinition)
		Registry.order = make([]string, 0)

		// Create fake GroupResources that map to our fake config resources
		playlistGR := schema.GroupResource{Resource: "fake", Group: "playlists.resource"}
		folderGR := schema.GroupResource{Resource: "fake", Group: "folders.resource"}
		dashboardGR := schema.GroupResource{Resource: "fake", Group: "dashboards.resource"}

		Registry.Register(MigrationDefinition{
			ID:          "test-playlists",
			MigrationID: "playlists migration",
			Resources:   []ResourceInfo{{GroupResource: playlistGR}},
		})
		Registry.Register(MigrationDefinition{
			ID:          "test-folders-dashboards",
			MigrationID: "folders and dashboards migration",
			Resources:   []ResourceInfo{{GroupResource: folderGR}, {GroupResource: dashboardGR}},
		})
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
	runAndGetMigrationIDs := func(cfg *setting.Cfg) ([]string, error) {
		var ids []string
		var capturedErr error
		_ = sqlstoremigrator.CheckExpectedMigrations(sqlstoremigrator.SQLite,
			[]sqlstoremigrator.ExpectedMigration{},
			func(mg *sqlstoremigrator.Migrator) {
				capturedErr = registerMigrations(context.Background(), cfg, mg, nil, nil, nil)
				ids = mg.GetMigrationIDs(false)
			})
		return ids, capturedErr
	}

	t.Run("playlists enabled registers migration", func(t *testing.T) {
		setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  true,
			fakeFolderResource:    false,
			fakeDashboardResource: false,
		})

		ids, err := runAndGetMigrationIDs(cfg)
		require.NoError(t, err)
		require.Contains(t, ids, "playlists migration")
		require.NotContains(t, ids, "folders and dashboards migration")
	})

	t.Run("folders+dashboards both enabled registers migration", func(t *testing.T) {
		setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    true,
			fakeDashboardResource: true,
		})

		ids, err := runAndGetMigrationIDs(cfg)
		require.NoError(t, err)
		require.Contains(t, ids, "folders and dashboards migration")
		require.NotContains(t, ids, "playlists migration")
	})

	t.Run("mismatched enablement returns error", func(t *testing.T) {
		setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    true,
			fakeDashboardResource: false,
		})

		_, err := runAndGetMigrationIDs(cfg)
		require.Error(t, err, "expected error for mismatched enablement")
	})

	t.Run("all disabled registers nothing", func(t *testing.T) {
		setupFakeRegistry()
		cfg := makeCfg(map[string]bool{
			fakePlaylistResource:  false,
			fakeFolderResource:    false,
			fakeDashboardResource: false,
		})

		ids, err := runAndGetMigrationIDs(cfg)
		require.NoError(t, err)
		require.Empty(t, ids)
	})
}

// TestResourceMigration_AutoMigrateEnablesMode5 verifies the autoMigrate behavior:
// - When autoMigrate=true AND cfg is set AND storage type is "unified", mode 5 should be enabled
// - In all other cases, mode 5 should NOT be enabled
func TestResourceMigration_AutoMigrateEnablesMode5(t *testing.T) {
	// Helper to create a cfg with unified storage type
	makeUnifiedCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.Raw.Section("grafana-apiserver").Key("storage_type").SetValue("unified")
		cfg.UnifiedStorage = make(map[string]setting.UnifiedStorageConfig)
		return cfg
	}

	// Helper to create a cfg with legacy storage type
	makeLegacyCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.Raw.Section("grafana-apiserver").Key("storage_type").SetValue("legacy")
		cfg.UnifiedStorage = make(map[string]setting.UnifiedStorageConfig)
		return cfg
	}

	tests := []struct {
		name             string
		autoMigrate      bool
		cfg              *setting.Cfg
		resources        []string
		wantMode5Enabled bool
		description      string
	}{
		{
			name:             "autoMigrate enabled with unified storage",
			autoMigrate:      true,
			cfg:              makeUnifiedCfg(),
			resources:        []string{setting.DashboardResource},
			wantMode5Enabled: true,
			description:      "Should enable mode 5 when autoMigrate=true and storage type is unified",
		},
		{
			name:             "autoMigrate disabled with unified storage",
			autoMigrate:      false,
			cfg:              makeUnifiedCfg(),
			resources:        []string{setting.DashboardResource},
			wantMode5Enabled: false,
			description:      "Should NOT enable mode 5 when autoMigrate=false",
		},
		{
			name:             "autoMigrate enabled with legacy storage",
			autoMigrate:      true,
			cfg:              makeLegacyCfg(),
			resources:        []string{setting.DashboardResource},
			wantMode5Enabled: false,
			description:      "Should NOT enable mode 5 when storage type is legacy",
		},
		{
			name:             "autoMigrate enabled with nil cfg",
			autoMigrate:      true,
			cfg:              nil,
			resources:        []string{setting.DashboardResource},
			wantMode5Enabled: false,
			description:      "Should NOT enable mode 5 when cfg is nil",
		},
		{
			name:             "autoMigrate enabled with multiple resources",
			autoMigrate:      true,
			cfg:              makeUnifiedCfg(),
			resources:        []string{setting.FolderResource, setting.DashboardResource},
			wantMode5Enabled: true,
			description:      "Should enable mode 5 for all resources when autoMigrate=true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Build schema.GroupResource from resource strings
			resources := make([]schema.GroupResource, 0, len(tt.resources))
			for _, r := range tt.resources {
				parts := strings.SplitN(r, ".", 2)
				resources = append(resources, schema.GroupResource{
					Resource: parts[0],
					Group:    parts[1],
				})
			}

			// Create the migration with options
			var opts []ResourceMigrationOption
			if tt.autoMigrate {
				opts = append(opts, WithAutoMigrate(tt.cfg))
			}

			m := NewResourceMigration(nil, resources, "test-auto-migrate", nil, opts...)

			// Simulate what happens at the end of a successful migration
			// This is the logic from MigrationRunner.Run() that we're testing
			// Note: EnableMode5 should only be called for unified storage type
			if m.runner.autoEnableMode5 && m.runner.cfg != nil && m.runner.cfg.UnifiedStorageType() == "unified" {
				for _, gr := range m.resources {
					m.runner.cfg.EnableMode5(gr.Resource + "." + gr.Group)
				}
			}

			// Verify mode 5 was enabled (or not) for each resource
			for _, resourceName := range tt.resources {
				if tt.cfg == nil {
					// If cfg is nil, we can't check - just verify we didn't panic
					continue
				}
				config := tt.cfg.UnifiedStorageConfig(resourceName)
				if tt.wantMode5Enabled {
					require.Equal(t, 5, int(config.DualWriterMode), "%s: %s", tt.description, resourceName)
					require.True(t, config.EnableMigration, "%s: EnableMigration should be true for %s", tt.description, resourceName)
				} else {
					require.Equal(t, 0, int(config.DualWriterMode), "%s: mode should be 0 for %s", tt.description, resourceName)
				}
			}
		})
	}
}

// TestResourceMigration_SkipMigrationLog verifies the SkipMigrationLog behavior:
//   - When ignoreErrors=true AND errors occurred (hadErrors=true), skip writing to migration log
//     This allows the migration to be re-run on the next startup
//   - In all other cases, write to migration log normally
//
// This is important for the folders/dashboards migration which uses WithIgnoreErrors() to handle
// partial failures gracefully while still allowing retry on next startup.
func TestResourceMigration_SkipMigrationLog(t *testing.T) {
	tests := []struct {
		name        string
		autoMigrate bool
		hadErrors   bool
		want        bool
		description string
	}{
		{
			name:        "normal migration success",
			autoMigrate: false,
			hadErrors:   false,
			want:        false,
			description: "Normal successful migration should write to log",
		},
		{
			name:        "ignoreErrors migration success",
			autoMigrate: true,
			hadErrors:   false,
			want:        false,
			description: "Migration with ignoreErrors that succeeds should still write to log",
		},
		{
			name:        "normal migration with errors",
			autoMigrate: false,
			hadErrors:   true,
			want:        false,
			description: "Migration that fails without ignoreErrors should write error to log",
		},
		{
			name:        "ignoreErrors migration with errors - skip log",
			autoMigrate: true,
			hadErrors:   true,
			want:        true,
			description: "Migration with ignoreErrors that has errors should SKIP log to allow retry",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &ResourceMigration{
				autoMigrate: tt.autoMigrate,
				hadErrors:   tt.hadErrors,
			}
			require.Equal(t, tt.want, m.SkipMigrationLog(), tt.description)
		})
	}
}
