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
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

// Test if the service is disabled
func TestService_IsDisabled(t *testing.T) {
	// Create a new service
	s, err := ProvideService(
		&setting.Cfg{
			PreinstallPlugins:      []setting.InstallPlugin{{ID: "myplugin"}},
			PreinstallPluginsAsync: true,
		},
		pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
		&fakes.FakePluginInstaller{},
		prometheus.NewRegistry(),
		&fakes.FakePluginRepo{},
		featuremgmt.WithFeatures(),
	)
	require.NoError(t, err)

	// Check if the service is disabled
	if s.IsDisabled() {
		t.Error("Service should be enabled")
	}
}

func TestService_Run(t *testing.T) {
	tests := []struct {
		name             string
		shouldInstall    bool
		pluginsToInstall []setting.InstallPlugin
		existingPlugins  []*plugins.Plugin
		pluginsToFail    []string
		blocking         bool
		latestPlugin     *repo.PluginArchiveInfo
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
			name:             "Install a blocking plugin",
			shouldInstall:    true,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin"}},
			blocking:         true,
		},
		{
			name:             "Fails to install a blocking plugin",
			shouldInstall:    false,
			pluginsToInstall: []setting.InstallPlugin{{ID: "myplugin"}},
			blocking:         true,
			pluginsToFail:    []string{"myplugin"},
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
					PreinstallPlugins:      tt.pluginsToInstall,
					PreinstallPluginsAsync: !tt.blocking,
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
						for _, plugin := range tt.pluginsToInstall {
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
			)
			if tt.blocking && !tt.shouldInstall {
				require.ErrorContains(t, err, "Failed to install plugin")
			} else {
				require.NoError(t, err)
			}

			if !tt.blocking {
				err = s.Run(context.Background())
				require.NoError(t, err)
			}
			if tt.shouldInstall {
				expectedInstalled := 0
				expectedInstalledFromURL := 0
				for _, plugin := range tt.pluginsToInstall {
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
