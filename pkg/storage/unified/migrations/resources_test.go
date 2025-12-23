package migrations

import (
	"context"
	"strings"
	"testing"

	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestRegisterMigrations exercises registerMigrations with various EnableMigration configs using a table-driven test.
func TestRegisterMigrations(t *testing.T) {
	origRegistry := migrationRegistry
	t.Cleanup(func() { migrationRegistry = origRegistry })

	// helper to build a fake registry with custom register funcs that bump counters
	makeFakeRegistry := func(migrationCalls map[string]int) []migrationDefinition {
		return []migrationDefinition{
			{
				name:      "playlists",
				resources: []string{setting.PlaylistResource},
				registerFunc: func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient, opts ...ResourceMigrationOption) {
					migrationCalls["playlists"]++
				},
			},
			{
				name:      "folders and dashboards",
				resources: []string{setting.FolderResource, setting.DashboardResource},
				registerFunc: func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient, opts ...ResourceMigrationOption) {
					migrationCalls["folders and dashboards"]++
				},
			},
		}
	}

	// Build a minimal cfg with UnifiedStorage entries used by registerMigrations
	makeCfg := func(vals map[string]bool) *setting.Cfg {
		cfg := &setting.Cfg{UnifiedStorage: make(map[string]setting.UnifiedStorageConfig)}
		for k, v := range vals {
			cfg.UnifiedStorage[k] = setting.UnifiedStorageConfig{
				EnableMigration:        v,
				AutoMigrationThreshold: -1, // Disable auto-migration to avoid needing sqlStore
			}
		}
		return cfg
	}

	// Table of scenarios
	tests := []struct {
		name              string
		enablePlaylist    bool
		enableFolder      bool
		enableDashboard   bool
		wantPlaylistCalls int
		wantFDCalls       int
		wantErr           bool
	}{
		{name: "playlists enabled", enablePlaylist: true, wantPlaylistCalls: 1},
		{name: "playlists disabled", enablePlaylist: false, wantPlaylistCalls: 0},
		{name: "folders+dashboards both enabled", enableFolder: true, enableDashboard: true, wantFDCalls: 1},
		{name: "folders enabled, dashboards disabled (mismatch)", enableFolder: true, enableDashboard: false, wantFDCalls: 0, wantErr: true},
		{name: "folders disabled, dashboards enabled (mismatch)", enableFolder: false, enableDashboard: true, wantFDCalls: 0, wantErr: true},
		{name: "folders+dashboards both disabled", enableFolder: false, enableDashboard: false, wantFDCalls: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			migrationCalls := map[string]int{
				"playlists":              0,
				"folders and dashboards": 0,
			}

			migrationRegistry = makeFakeRegistry(migrationCalls)

			cfg := makeCfg(map[string]bool{
				setting.PlaylistResource:  tt.enablePlaylist,
				setting.FolderResource:    tt.enableFolder,
				setting.DashboardResource: tt.enableDashboard,
			})

			// We pass nils for migrator dependencies because our fake registerFuncs don't use them
			err := registerMigrations(context.Background(), cfg, nil, nil, nil, nil)

			if tt.wantErr {
				require.Error(t, err, "expected error for mismatched enablement")
			} else {
				require.NoError(t, err, "unexpected error")
			}

			require.Equal(t, tt.wantPlaylistCalls, migrationCalls["playlists"], "playlists register call count")
			require.Equal(t, tt.wantFDCalls, migrationCalls["folders and dashboards"], "folders+dashboards register call count")
		})
	}
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
			resources:        []string{setting.PlaylistResource},
			wantMode5Enabled: true,
			description:      "Should enable mode 5 when autoMigrate=true and storage type is unified",
		},
		{
			name:             "autoMigrate disabled with unified storage",
			autoMigrate:      false,
			cfg:              makeUnifiedCfg(),
			resources:        []string{setting.PlaylistResource},
			wantMode5Enabled: false,
			description:      "Should NOT enable mode 5 when autoMigrate=false",
		},
		{
			name:             "autoMigrate enabled with legacy storage",
			autoMigrate:      true,
			cfg:              makeLegacyCfg(),
			resources:        []string{setting.PlaylistResource},
			wantMode5Enabled: false,
			description:      "Should NOT enable mode 5 when storage type is legacy",
		},
		{
			name:             "autoMigrate enabled with nil cfg",
			autoMigrate:      true,
			cfg:              nil,
			resources:        []string{setting.PlaylistResource},
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
			opts = append(opts, WithAutoMigrate(tt.cfg, tt.autoMigrate))

			m := NewResourceMigration(nil, resources, "test-auto-migrate", nil, opts...)

			// Simulate what happens at the end of a successful migration
			// This is the logic from Exec() that we're testing
			if m.autoMigrate && m.cfg != nil && m.cfg.UnifiedStorageType() == "unified" {
				for _, gr := range m.resources {
					m.cfg.EnableMode5(gr.Resource + "." + gr.Group)
				}
			}

			// Verify mode 5 was enabled (or not) for each resource
			for _, resourceName := range tt.resources {
				if tt.cfg == nil {
					// If cfg is nil, we can't check - just verify we didn't panic
					continue
				}
				config := tt.cfg.GetUnifiedStorageConfig(resourceName)
				if tt.wantMode5Enabled {
					require.Equal(t, 5, int(config.DualWriterMode), "%s: %s", tt.description, resourceName)
					require.True(t, config.EnableMigration, "%s: EnableMigration should be true for %s", tt.description, resourceName)
					require.True(t, config.DualWriterMigrationDataSyncDisabled, "%s: DualWriterMigrationDataSyncDisabled should be true for %s", tt.description, resourceName)
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
		name         string
		ignoreErrors bool
		hadErrors    bool
		want         bool
		description  string
	}{
		{
			name:         "normal migration success",
			ignoreErrors: false,
			hadErrors:    false,
			want:         false,
			description:  "Normal successful migration should write to log",
		},
		{
			name:         "ignoreErrors migration success",
			ignoreErrors: true,
			hadErrors:    false,
			want:         false,
			description:  "Migration with ignoreErrors that succeeds should still write to log",
		},
		{
			name:         "normal migration with errors",
			ignoreErrors: false,
			hadErrors:    true,
			want:         false,
			description:  "Migration that fails without ignoreErrors should write error to log",
		},
		{
			name:         "ignoreErrors migration with errors - skip log",
			ignoreErrors: true,
			hadErrors:    true,
			want:         true,
			description:  "Migration with ignoreErrors that has errors should SKIP log to allow retry",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &ResourceMigration{
				ignoreErrors: tt.ignoreErrors,
				hadErrors:    tt.hadErrors,
			}
			require.Equal(t, tt.want, m.SkipMigrationLog(), tt.description)
		})
	}
}
