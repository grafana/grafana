package migrations

import (
	"testing"

	sqlstoremigrator "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
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
				registerFunc: func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
					migrationCalls["playlists"]++
				},
			},
			{
				name:      "folders and dashboards",
				resources: []string{setting.FolderResource, setting.DashboardResource},
				registerFunc: func(mg *sqlstoremigrator.Migrator, migrator UnifiedMigrator, client resource.ResourceClient) {
					migrationCalls["folders and dashboards"]++
				},
			},
		}
	}

	// Build a minimal cfg with UnifiedStorage entries used by registerMigrations
	makeCfg := func(vals map[string]bool) *setting.Cfg {
		cfg := &setting.Cfg{UnifiedStorage: make(map[string]setting.UnifiedStorageConfig)}
		for k, v := range vals {
			cfg.UnifiedStorage[k] = setting.UnifiedStorageConfig{EnableMigration: v}
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
			err := registerMigrations(cfg, nil, nil, nil)

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
