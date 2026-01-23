package pluginassets

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

// cdnFS is a simple mock FS that returns CDN type
type cdnFS struct {
	plugins.FS
}

func (f *cdnFS) Type() plugins.FSType {
	return plugins.FSTypeCDN
}

func TestCalculateLoadingStrategy(t *testing.T) {
	const pluginID = "grafana-test-datasource"

	const (
		incompatVersion = "4.14.0"
		compatVersion   = CreatePluginVersionScriptSupportEnabled
		futureVersion   = "5.0.0"
	)

	tcs := []struct {
		name           string
		pluginSettings config.PluginSettings
		plugin         *plugins.Plugin
		expected       plugins.LoadingStrategy
	}{
		{
			name: "Expected LoadingStrategyScript when create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when parent create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings("parent-datasource", map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin: newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{
					JSONData: plugins.JSONData{ID: "parent-datasource"},
					FS:       plugins.NewFakeFS(),
				}
			}),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is future compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: futureVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name:           "Expected LoadingStrategyScript when create-plugin version is not provided, plugin is not angular and is not configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{}),
			plugin:         newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected:       plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is not compatible, plugin is not angular, is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withClassForLoadingStrategy(plugins.ClassExternal), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is not angular",
			pluginSettings: config.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{
					JSONData: plugins.JSONData{ID: "parent-datasource"},
					FS:       plugins.NewFakeFS(),
				}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is angular",
			pluginSettings: config.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(true), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{
					JSONData: plugins.JSONData{ID: "parent-datasource"},
					FS:       plugins.NewFakeFS(),
				}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name:           "Expected LoadingStrategyFetch when parent create-plugin version is not set, is not configured as CDN enabled and plugin is angular",
			pluginSettings: config.PluginSettings{},
			plugin: newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(true), withFSForLoadingStrategy(plugins.NewFakeFS()), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{
					JSONData: plugins.JSONData{ID: "parent-datasource"},
					FS:       plugins.NewFakeFS(),
				}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular, and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withClassForLoadingStrategy(plugins.ClassExternal), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible and plugin is angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(true), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and has a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin: newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withFSForLoadingStrategy(
				&cdnFS{FS: plugins.NewFakeFS()},
			)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyScript when plugin setting create-plugin version is badly formatted, plugin is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: "invalidSemver",
			}),
			plugin:   newPluginForLoadingStrategy(pluginID, withAngularForLoadingStrategy(false), withFSForLoadingStrategy(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &config.PluginManagementCfg{
				PluginSettings: tc.pluginSettings,
			}
			cdn := pluginscdn.ProvideService(&config.PluginManagementCfg{
				PluginsCDNURLTemplate: "http://cdn.example.com", // required for cdn.PluginSupported check
				PluginSettings:        tc.pluginSettings,
			})

			got := CalculateLoadingStrategy(tc.plugin, cfg, cdn)
			assert.Equal(t, tc.expected, got, "unexpected loading strategy")
		})
	}
}

func newPluginForLoadingStrategy(pluginID string, cbs ...func(*plugins.Plugin)) *plugins.Plugin {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginID,
		},
	}
	for _, cb := range cbs {
		cb(p)
	}
	return p
}

func withAngularForLoadingStrategy(angular bool) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.Angular = plugins.AngularMeta{Detected: angular}
	}
}

func withFSForLoadingStrategy(fs plugins.FS) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.FS = fs
	}
}

func withClassForLoadingStrategy(class plugins.Class) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.Class = class
	}
}

func newPluginSettings(pluginID string, kv map[string]string) config.PluginSettings {
	return config.PluginSettings{
		pluginID: kv,
	}
}
