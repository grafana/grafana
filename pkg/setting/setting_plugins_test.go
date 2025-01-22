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
			disablePreinstall bool
			expected          []InstallPlugin
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
				expected: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "", ""}),
			},
			{
				name:     "should add the default preinstalled plugin and the one defined with version",
				rawInput: "plugin1@1.0.0",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "1.0.0", ""}),
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
				expected:     append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "", ""}),
			},
			{
				name:     "should parse a plugin with version and URL",
				rawInput: "plugin1@1.0.1@https://example.com/plugin1.tar.gz",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "1.0.1", "https://example.com/plugin1.tar.gz"}),
			},
			{
				name:     "should parse a plugin with URL",
				rawInput: "plugin1@@https://example.com/plugin1.tar.gz",
				expected: append(defaultPreinstallPluginsList, InstallPlugin{"plugin1", "", "https://example.com/plugin1.tar.gz"}),
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				cfg := NewCfg()
				sec, err := cfg.Raw.NewSection("plugins")
				require.NoError(t, err)
				_, err = sec.NewKey("preinstall", tc.rawInput)
				require.NoError(t, err)
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
				assert.ElementsMatch(t, cfg.PreinstallPlugins, tc.expected)
				if tc.disableAsync {
					require.Equal(t, cfg.PreinstallPluginsAsync, false)
				}
			})
		}
	})
}
