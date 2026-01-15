package pluginassets

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestService_Calculate(t *testing.T) {
	const pluginID = "grafana-test-datasource"

	const (
		incompatVersion = "4.14.0"
		compatVersion   = CreatePluginVersionScriptSupportEnabled
		futureVersion   = "5.0.0"
	)

	tcs := []struct {
		name           string
		pluginSettings config.PluginSettings
		plugin         pluginstore.Plugin
		expected       plugins.LoadingStrategy
	}{
		{
			name: "Expected LoadingStrategyScript when create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when parent create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings("parent-datasource", map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is future compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: futureVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name:           "Expected LoadingStrategyScript when create-plugin version is not provided, plugin is not angular and is not configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				// NOTE: cdn key is not set
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is not compatible, plugin is not angular, is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
				// NOTE: cdn key is not set
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withClass(plugins.ClassExternal), withFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is not angular",
			pluginSettings: config.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
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
			plugin: newPlugin(pluginID, withAngular(true), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name:           "Expected LoadingStrategyFetch when parent create-plugin version is not set, is not configured as CDN enabled and plugin is angular",
			pluginSettings: config.PluginSettings{},
			plugin: newPlugin(pluginID, withAngular(true), withFS(plugins.NewFakeFS()), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular, and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withClass(plugins.ClassExternal)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible and plugin is angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(true), withFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and has a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin: newPlugin(pluginID, withAngular(false), withFS(
				&pluginfakes.FakePluginFS{
					TypeFunc: func() plugins.FSType {
						return plugins.FSTypeCDN
					},
				},
			)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyScript when plugin setting create-plugin version is badly formatted, plugin is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: "invalidSemver",
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{
				cfg: newCfg(tc.pluginSettings),
				cdn: pluginscdn.ProvideService(&config.PluginManagementCfg{
					PluginsCDNURLTemplate: "http://cdn.example.com", // required for cdn.PluginSupported check
					PluginSettings:        tc.pluginSettings,
				}),
				log: log.NewNopLogger(),
			}

			got := s.LoadingStrategy(context.Background(), tc.plugin)
			assert.Equal(t, tc.expected, got, "unexpected loading strategy")
		})
	}
}

func newPlugin(pluginID string, cbs ...func(p pluginstore.Plugin) pluginstore.Plugin) pluginstore.Plugin {
	p := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginID,
		},
	}
	for _, cb := range cbs {
		p = cb(p)
	}
	return p
}

func withFS(fs plugins.FS) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.FS = fs
		return p
	}
}

func withAngular(angular bool) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Angular = plugins.AngularMeta{Detected: angular}
		return p
	}
}

func withClass(class plugins.Class) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Class = class
		return p
	}
}

func newCfg(ps config.PluginSettings) *config.PluginManagementCfg {
	return &config.PluginManagementCfg{
		PluginSettings: ps,
	}
}

func newPluginSettings(pluginID string, kv map[string]string) config.PluginSettings {
	return config.PluginSettings{
		pluginID: kv,
	}
}
