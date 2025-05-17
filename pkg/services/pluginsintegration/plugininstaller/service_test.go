package plugininstaller

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

// Test if the service is disabled
func TestService_IsDisabled(t *testing.T) {
	// Create a new service
	s, err := ProvideService(
		&setting.Cfg{
			PreinstallPluginsAsync: []setting.InstallPlugin{{ID: "myplugin"}},
		},
		pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
		&fakes.FakePluginInstaller{},
		prometheus.NewRegistry(),
		&fakes.FakePluginRepo{},
		featuremgmt.WithFeatures(),
		&pluginchecker.FakePluginUpdateChecker{},
	)
	require.NoError(t, err)

	// Check if the service is disabled
	if s.IsDisabled() {
		t.Error("Service should be enabled")
	}
}

func TestService_Run(t *testing.T) {
	tests := []struct {
		name                 string
		shouldInstall        bool
		shouldThrowError     bool
		pluginsToInstall     []setting.InstallPlugin
		pluginsToInstallSync []setting.InstallPlugin
		existingPlugins      []*plugins.Plugin
		pluginsToFail        []string
		latestPlugin         *repo.PluginArchiveInfo
	}{
		{
			name:             "Installs a plugin",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin"}},
		},
		{
			name:             "Install a plugin with version",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: "1.0.0"}},
		},
		{
			name:             "Skips already installed plugin",
			shouldThrowError: false,
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin"}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin"}}},
		},
		{
			name:             "Still installs a plugin if the plugin version does not match",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: "2.0.0"}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.0"}}}},
		},
		{
			name:             "Install multiple plugins",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin1"}, {ID: "myplugin2"}},
		},
		{
			name:             "Fails to install a plugin but install the rest",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin1"}, {ID: "myplugin2"}},
			pluginsToFail:    []string{"myplugin1"},
		},
		{
			name:                 "Install a plugin from sync list",
			shouldInstall:        true,
			pluginsToInstallSync: []setting.InstallPlugin{{ID: "myplugin"}},
		},
		{
			name:                 "when installation fails in sync mode, it should throw an error",
			shouldInstall:        false,
			shouldThrowError:     true,
			pluginsToInstallSync: []setting.InstallPlugin{{ID: "myplugin"}},
			pluginsToFail:        []string{"myplugin"},
		},
		{
			name:             "Updates a plugin",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: ""}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.0"}}}},
			latestPlugin:     &repo.PluginArchiveInfo{Version: "1.0.1"},
		},
		{
			name:             "Should not update a plugin if the latest version is installed",
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: ""}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.0"}}}},
			latestPlugin:     &repo.PluginArchiveInfo{Version: "1.0.0"},
		},
		{
			name:             "Should not update a plugin if the latest version is a major version",
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: ""}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.0"}}}},
			latestPlugin:     &repo.PluginArchiveInfo{Version: "2.0.0"},
		},
		{
			name:             "Should install a plugin with a URL",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", URL: "https://example.com/myplugin.tar.gz"}},
		},
		{
			name:             "Should not update a plugin if the current version is greater than the latest version",
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: ""}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.1"}}}},
			latestPlugin:     &repo.PluginArchiveInfo{Version: "1.0.0"},
		},
		{
			name:             "Should not update a plugin if the current version is equal to the latest version, ignoring the prerelease",
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin", Version: ""}},
			existingPlugins:  []*plugins.Plugin{{JSONData: plugins.JSONData{ID: "myplugin", Info: plugins.Info{Version: "1.0.0"}}}},
			latestPlugin:     &repo.PluginArchiveInfo{Version: "1.0.0-rc.1"},
		},
		{
			name:                 "should install all plugins - sync and async",
			shouldInstall:        true,
			pluginsToInstallSync: []setting.InstallPlugin{{ID: "myplugin"}},
			pluginsToInstall:     []setting.InstallPlugin{{ID: "myplugin2"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			preg := registry.NewInMemory()
			for _, plugin := range tt.existingPlugins {
				err := preg.Add(context.Background(), plugin)
				require.NoError(t, err)
			}
			installed := 0
			installedFromURL := 0
			s, err := ProvideService(
				&setting.Cfg{
					PreinstallPluginsAsync: tt.pluginsToInstall,
					PreinstallPluginsSync:  tt.pluginsToInstallSync,
				},
				pluginstore.New(preg, &fakes.FakeLoader{}),
				&fakes.FakePluginInstaller{
					AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.AddOpts) error {
						for _, plugin := range tt.pluginsToFail {
							if plugin == pluginID {
								return errors.New("Failed to install plugin")
							}
						}
						if !tt.shouldInstall {
							t.Fatal("Should not install plugin")
							return errors.New("Should not install plugin")
						}
						allPluginsToInstall := append(tt.pluginsToInstallSync, tt.pluginsToInstall...)
						for _, plugin := range allPluginsToInstall {
							if plugin.ID == pluginID && plugin.Version == version {
								if opts.URL() != "" {
									installedFromURL++
								} else {
									installed++
								}
							}
						}
						return nil
					},
				},
				prometheus.NewRegistry(),
				&fakes.FakePluginRepo{
					GetPluginArchiveInfoFunc: func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchiveInfo, error) {
						return tt.latestPlugin, nil
					},
				},
				featuremgmt.WithFeatures(featuremgmt.FlagPreinstallAutoUpdate),
				pluginchecker.ProvideService(
					managedplugins.NewNoop(),
					provisionedplugins.NewNoop(),
					&pluginchecker.FakePluginPreinstall{},
				),
			)
			if tt.shouldThrowError {
				require.ErrorContains(t, err, "Failed to install plugin")
				return
			}
			require.NoError(t, err)
			err = s.Run(context.Background())
			require.NoError(t, err)

			if tt.shouldInstall {
				expectedInstalled := 0
				expectedInstalledFromURL := 0
				allPluginsToInstall := append(tt.pluginsToInstallSync, tt.pluginsToInstall...)
				for _, plugin := range allPluginsToInstall {
					expectedFailed := false
					for _, pluginFail := range tt.pluginsToFail {
						if plugin.ID == pluginFail {
							expectedFailed = true
							break
						}
					}
					if expectedFailed {
						continue
					}
					if plugin.URL != "" {
						expectedInstalledFromURL++
					} else {
						expectedInstalled++
					}
				}
				require.Equal(t, expectedInstalled, installed)
				require.Equal(t, expectedInstalledFromURL, installedFromURL)
			}
		})
	}
}
