package manager

import (
	"os"
	"sort"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestPluginSettings(t *testing.T) {
	t.Run("Should only extract from sections beginning with 'plugin.' in config", func(t *testing.T) {
		cfg := &setting.Cfg{
			PluginSettings: setting.PluginSettings{
				"plugin": map[string]string{
					"key1": "value1",
					"key2": "value2",
				},
			},
		}

		ps := getPluginSettings("plugin", cfg)
		require.Len(t, ps, 2)

		t.Run("Should skip path setting", func(t *testing.T) {
			cfg.PluginSettings["plugin"]["path"] = "value"
			ps := getPluginSettings("plugin", cfg)
			require.Len(t, ps, 2)
		})

		t.Run("Should skip id setting", func(t *testing.T) {
			cfg.PluginSettings["plugin"]["id"] = "value"
			ps := getPluginSettings("plugin", cfg)
			require.Len(t, ps, 2)
		})

		t.Run("Should return expected environment variables from plugin settings ", func(t *testing.T) {
			ps := getPluginSettings("plugin", cfg)
			env := ps.ToEnv("GF_PLUGIN", []string{"GF_VERSION=6.7.0"})
			sort.Strings(env)
			require.Len(t, env, 3)
			require.EqualValues(t, []string{"GF_PLUGIN_KEY1=value1", "GF_PLUGIN_KEY2=value2", "GF_VERSION=6.7.0"}, env)
		})

		t.Run("Should override config variable with environment variable ", func(t *testing.T) {
			_ = os.Setenv("GF_PLUGIN_KEY1", "sth")
			t.Cleanup(func() {
				_ = os.Unsetenv("GF_PLUGIN_KEY1")
			})

			ps := getPluginSettings("plugin", cfg)
			env := ps.ToEnv("GF_PLUGIN", []string{"GF_VERSION=6.7.0"})
			sort.Strings(env)
			require.Len(t, env, 3)
			require.EqualValues(t, []string{"GF_PLUGIN_KEY1=sth", "GF_PLUGIN_KEY2=value2", "GF_VERSION=6.7.0"}, env)
		})

		t.Run("Config variable doesn't match env variable ", func(t *testing.T) {
			_ = os.Setenv("GF_PLUGIN_KEY3", "value3")
			t.Cleanup(func() {
				_ = os.Unsetenv("GF_PLUGIN_KEY3")
			})

			ps := getPluginSettings("plugin", cfg)
			env := ps.ToEnv("GF_PLUGIN", []string{"GF_VERSION=6.7.0"})
			sort.Strings(env)
			require.Len(t, env, 3)
			require.EqualValues(t, []string{"GF_PLUGIN_KEY1=value1", "GF_PLUGIN_KEY2=value2", "GF_VERSION=6.7.0"}, env)
		})

		t.Run("Should override missing config variable with environment variable ", func(t *testing.T) {
			cfg := &setting.Cfg{
				PluginSettings: setting.PluginSettings{
					"plugin": map[string]string{
						"key1": "value1",
						"key2": "",
					},
				},
			}

			ps := getPluginSettings("plugin", cfg)
			require.Len(t, ps, 2)

			_ = os.Setenv("GF_PLUGIN_KEY2", "sth")
			t.Cleanup(func() {
				_ = os.Unsetenv("GF_PLUGIN_KEY1")
			})

			env := ps.ToEnv("GF_PLUGIN", []string{"GF_VERSION=6.7.0"})
			sort.Strings(env)
			require.Len(t, env, 3)
			require.EqualValues(t, []string{"GF_PLUGIN_KEY1=value1", "GF_PLUGIN_KEY2=sth", "GF_VERSION=6.7.0"}, env)
		})
	})
}
