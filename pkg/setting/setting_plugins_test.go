package setting

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginSettings(t *testing.T) {
	cfg := NewCfg()
	sec, err := cfg.Raw.NewSection("plugin")
	require.NoError(t, err)
	_, err = sec.NewKey("key", "value")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("plugin.plugin")
	require.NoError(t, err)
	_, err = sec.NewKey("key1", "value1")
	require.NoError(t, err)
	_, err = sec.NewKey("key2", "value2")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("plugin.plugin2")
	require.NoError(t, err)
	_, err = sec.NewKey("key3", "value3")
	require.NoError(t, err)
	_, err = sec.NewKey("key4", "value4")
	require.NoError(t, err)

	sec, err = cfg.Raw.NewSection("other")
	require.NoError(t, err)
	_, err = sec.NewKey("keySomething", "whatever")
	require.NoError(t, err)

	ps := extractPluginSettings(cfg.Raw.Sections())
	require.Len(t, ps, 2)
	require.Len(t, ps["plugin"], 2)
	require.Equal(t, ps["plugin"]["key1"], "value1")
	require.Equal(t, ps["plugin"]["key2"], "value2")
	require.Len(t, ps["plugin2"], 2)
	require.Equal(t, ps["plugin2"]["key3"], "value3")
	require.Equal(t, ps["plugin2"]["key4"], "value4")
}

func Test_readPluginSettings(t *testing.T) {
	t.Run("should parse separated plugin ids", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			f    func(ids ...string) string
		}{
			{
				name: "commas",
				f: func(ids ...string) string {
					return strings.Join(ids, ",")
				},
			},
			{
				name: "commas and a space",
				f: func(ids ...string) string {
					return strings.Join(ids, ", ")
				},
			},
			{
				name: "spaces",
				f: func(ids ...string) string {
					return strings.Join(ids, " ")
				},
			},
			{
				name: "json-like",
				f: func(ids ...string) string {
					return `["` + strings.Join(ids, `","`) + `"]`
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				cfg := NewCfg()
				sec, err := cfg.Raw.NewSection("plugins")
				require.NoError(t, err)
				_, err = sec.NewKey("disable_plugins", tc.f("plugin1", "plugin2"))
				require.NoError(t, err)

				_, err = sec.NewKey("plugin_catalog_hidden_plugins", tc.f("plugin3"))
				require.NoError(t, err)

				_, err = sec.NewKey("hide_angular_deprecation", tc.f("a", "b", "c"))
				require.NoError(t, err)

				err = cfg.readPluginSettings(cfg.Raw)
				require.NoError(t, err)
				require.Equal(t, []string{"plugin1", "plugin2"}, cfg.DisablePlugins)
				require.Equal(t, []string{"plugin3", "plugin1", "plugin2"}, cfg.PluginCatalogHiddenPlugins)
				require.Equal(t, []string{"a", "b", "c"}, cfg.HideAngularDeprecation)
			})
		}
	})

	t.Run("when plugins.preinstall_sync is defined", func(t *testing.T) {
		tests := []struct {
			name              string
			rawInput          string
			expected          []InstallPlugin
			disablePlugins    string
			disablePreinstall bool
		}{
			{
				name:     "should add the plugin to the sync list - not contain default plugins like async list",
				rawInput: "plugin1",
				expected: []InstallPlugin{
					{ID: "plugin1", Version: "", URL: ""},
				},
			},
			{
				name:           "it should remove the disabled plugin",
				rawInput:       "plugin1,plugin2",
				disablePlugins: "plugin1",
				expected:       []InstallPlugin{{ID: "plugin2"}},
			},
			{
				name:              "should not process at all when preinstall is disabled",
				rawInput:          "plugin1",
				disablePreinstall: true,
				expected:          nil,
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				cfg := NewCfg()
				sec, err := cfg.Raw.NewSection("plugins")
				require.NoError(t, err)
				_, err = sec.NewKey("preinstall_sync", tc.rawInput)
				require.NoError(t, err)
				if tc.disablePreinstall {
					_, err = sec.NewKey("preinstall_disabled", "true")
					require.NoError(t, err)
				}
				if tc.disablePlugins != "" {
					_, err = sec.NewKey("disable_plugins", tc.disablePlugins)
					require.NoError(t, err)
				}
				err = cfg.readPluginSettings(cfg.Raw)
				require.NoError(t, err)
				assert.ElementsMatch(t, cfg.PreinstallPluginsSync, tc.expected)
			})
		}
	})

	t.Run("when plugins.preinstall is defined", func(t *testing.T) {
		defaultPreinstallPluginsList := make([]InstallPlugin, 0, len(defaultPreinstallPlugins))
		defaultPreinstallPluginsIDs := []string{}
		for _, p := range defaultPreinstallPlugins {
			defaultPreinstallPluginsList = append(defaultPreinstallPluginsList, p)
			defaultPreinstallPluginsIDs = append(defaultPreinstallPluginsIDs, p.ID)
		}
		tests := []struct {
			name              string
			rawInput          string
			rawInputSync      string
			disablePreinstall bool
			expected          []InstallPlugin
			expectedSync      []InstallPlugin
			disableAsync      bool
			disablePlugins    string
		}{
			{
				name:     "should add the default preinstalled plugin",
				rawInput: "",
				expected: defaultPreinstallPluginsList,
			},
			{
				name:     "should add the default preinstalled plugin and the one defined",
				rawInput: "plugin1",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{ID: "plugin1", Version: "", URL: ""}),
			},
			{
				name:     "should add the default preinstalled plugin and the one defined with version",
				rawInput: "plugin1@1.0.0",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{ID: "plugin1", Version: "1.0.0", URL: ""}),
			},
			{
				name:           "it should remove the disabled plugin",
				rawInput:       "plugin1",
				disablePlugins: "plugin1",
				expected:       defaultPreinstallPluginsList,
			},
			{
				name:           "it should remove default plugins",
				rawInput:       "",
				disablePlugins: strings.Join(defaultPreinstallPluginsIDs, ","),
				expected:       nil,
			},
			{
				name:              "should ignore input when preinstall is disabled",
				rawInput:          "plugin1",
				disablePreinstall: true,
				expected:          nil,
			},
			{
				name:         "should mark preinstall as sync",
				rawInput:     "plugin1",
				disableAsync: true,
				expected:     nil,
				expectedSync: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "", ""}),
			},
			{
				name:     "should parse a plugin with version and URL",
				rawInput: "plugin1@1.0.1@https://example.com/plugin1.tar.gz",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{ID: "plugin1", Version: "1.0.1", URL: "https://example.com/plugin1.tar.gz"}),
			},
			{
				name:     "should parse a plugin with URL",
				rawInput: "plugin1@@https://example.com/plugin1.tar.gz",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{ID: "plugin1", Version: "", URL: "https://example.com/plugin1.tar.gz"}),
			},
			{
				name:         "when preinstall_async is false, should add all plugins to preinstall_sync",
				rawInput:     "plugin1",
				rawInputSync: "plugin2",
				disableAsync: true,
				expected:     nil,
				expectedSync: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "", ""}, InstallPlugin{"plugin2", "", ""}),
			},
			{
				name:     "should overwrite default when user pins a version",
				rawInput: "grafana-pyroscope-app@4.0.0",
				expected: func() []InstallPlugin {
					var plugins []InstallPlugin
					for _, p := range defaultPreinstallPlugins {
						if p.ID == "grafana-pyroscope-app" {
							plugins = append(plugins, InstallPlugin{"grafana-pyroscope-app", "4.0.0", ""})
						} else {
							plugins = append(plugins, p)
						}
					}
					return plugins
				}(),
			},
			{
				name:         "when same plugin is defined in preinstall and preinstall_sync, should be only in preinstallSync",
				rawInput:     "plugin1",
				rawInputSync: "plugin1",
				expected:     defaultPreinstallPluginsList,
				expectedSync: []InstallPlugin{{ID: "plugin1"}},
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				cfg := NewCfg()
				sec, err := cfg.Raw.NewSection("plugins")
				require.NoError(t, err)
				_, err = sec.NewKey("preinstall", tc.rawInput)
				require.NoError(t, err)
				if tc.rawInputSync != "" {
					_, err = sec.NewKey("preinstall_sync", tc.rawInputSync)
					require.NoError(t, err)
				}
				if tc.disablePreinstall {
					_, err = sec.NewKey("preinstall_disabled", "true")
					require.NoError(t, err)
				}
				if tc.disableAsync {
					_, err = sec.NewKey("preinstall_async", "false")
					require.NoError(t, err)
				}
				if tc.disablePlugins != "" {
					_, err = sec.NewKey("disable_plugins", tc.disablePlugins)
					require.NoError(t, err)
				}

				err = cfg.readPluginSettings(cfg.Raw)
				require.NoError(t, err)
				assert.ElementsMatch(t, cfg.PreinstallPluginsAsync, tc.expected)
				if tc.expectedSync != nil {
					assert.ElementsMatch(t, cfg.PreinstallPluginsSync, tc.expectedSync)
				}
			})
		}
	})
}

func Test_migrateInstallPluginsToPreinstallPluginsSync(t *testing.T) {
	tests := []struct {
		name                string
		installPluginsVal   string
		installPluginsForce string
		preinstallPlugins   map[string]InstallPlugin
		expectedPlugins     map[string]InstallPlugin
	}{
		{
			name:              "should return empty map when GF_INSTALL_PLUGINS is not set",
			installPluginsVal: "",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins:   map[string]InstallPlugin{},
		},
		{
			name:              "should parse URL with folder format",
			installPluginsVal: "https://grafana.com/grafana/plugins/grafana-piechart-panel/;grafana-piechart-panel",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins: map[string]InstallPlugin{
				"grafana-piechart-panel": {
					ID:      "grafana-piechart-panel",
					Version: "",
					URL:     "https://grafana.com/grafana/plugins/grafana-piechart-panel/",
				},
			},
		},
		{
			name:              "should parse mixed formats",
			installPluginsVal: "https://github.com/VolkovLabs/business-links/releases/download/v1.2.1/volkovlabs-links-panel-1.2.1.zip;volkovlabs-links-panel,marcusolsson-static-datasource,volkovlabs-variable-panel",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins: map[string]InstallPlugin{
				"volkovlabs-links-panel": {
					ID:      "volkovlabs-links-panel",
					Version: "",
					URL:     "https://github.com/VolkovLabs/business-links/releases/download/v1.2.1/volkovlabs-links-panel-1.2.1.zip",
				},
				"marcusolsson-static-datasource": {
					ID:      "marcusolsson-static-datasource",
					Version: "",
					URL:     "",
				},
				"volkovlabs-variable-panel": {
					ID:      "volkovlabs-variable-panel",
					Version: "",
					URL:     "",
				},
			},
		},
		{
			name:              "should parse ID with version format",
			installPluginsVal: "volkovlabs-links-panel 1.2.1,marcusolsson-static-datasource 1.0.0,volkovlabs-variable-panel",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins: map[string]InstallPlugin{
				"volkovlabs-links-panel": {
					ID:      "volkovlabs-links-panel",
					Version: "1.2.1",
					URL:     "",
				},
				"marcusolsson-static-datasource": {
					ID:      "marcusolsson-static-datasource",
					Version: "1.0.0",
					URL:     "",
				},
				"volkovlabs-variable-panel": {
					ID:      "volkovlabs-variable-panel",
					Version: "",
					URL:     "",
				},
			},
		},
		{
			name:                "should return empty map when GF_INSTALL_PLUGINS_FORCE is true",
			installPluginsVal:   "grafana-piechart-panel",
			installPluginsForce: "true",
			preinstallPlugins:   map[string]InstallPlugin{},
			expectedPlugins:     map[string]InstallPlugin{},
		},
		{
			name:              "should skip plugins that are already configured",
			installPluginsVal: "plugin1 1.0.0,plugin2,plugin3",
			preinstallPlugins: map[string]InstallPlugin{
				"plugin1": {ID: "plugin1", Version: "1.0.1"},
				"plugin3": {ID: "plugin3"},
			},
			expectedPlugins: map[string]InstallPlugin{
				"plugin2": {
					ID: "plugin2",
				},
				"plugin3": {
					ID: "plugin3",
				},
				"plugin1": {
					ID:      "plugin1",
					Version: "1.0.1",
				},
			},
		},
		{
			name:              "should trim the space in the input",
			installPluginsVal: " plugin1 1.0.0,  plugin2, plugin3   ",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins: map[string]InstallPlugin{
				"plugin2": {
					ID: "plugin2",
				},
				"plugin3": {
					ID: "plugin3",
				},
				"plugin1": {
					ID:      "plugin1",
					Version: "1.0.0",
				},
			},
		},
		{name: "parse private plugin",
			installPluginsVal: "https://s3.our.domain/grafana-plugins/our-plugin-datasource-1.2.0+linux.zip;our-plugin-datasource 1.2.0",
			preinstallPlugins: map[string]InstallPlugin{},
			expectedPlugins: map[string]InstallPlugin{
				"our-plugin-datasource": {
					ID:      "our-plugin-datasource",
					Version: "1.2.0",
					URL:     "https://s3.our.domain/grafana-plugins/our-plugin-datasource-1.2.0+linux.zip",
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := NewCfg()

			cfg.migrateInstallPluginsToPreinstallPluginsSync(tc.installPluginsVal, tc.installPluginsForce, tc.preinstallPlugins)
			assert.Equal(t, len(tc.expectedPlugins), len(tc.preinstallPlugins), "Number of plugins doesn't match")

			// Check each expected plugin exists with correct values
			for id, expectedPlugin := range tc.expectedPlugins {
				actualPlugin, exists := tc.preinstallPlugins[id]
				assert.True(t, exists, "Expected plugin %s not found", id)
				if exists {
					assert.Equal(t, expectedPlugin.ID, actualPlugin.ID, "Plugin ID mismatch for %s", id)
					assert.Equal(t, expectedPlugin.Version, actualPlugin.Version, "Plugin version mismatch for %s", id)
					assert.Equal(t, expectedPlugin.URL, actualPlugin.URL, "Plugin URL mismatch for %s", id)
				}
			}
		})
	}
}
