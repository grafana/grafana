package backendplugin

import (
	"sort"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestPluginSettings(t *testing.T) {
	t.Run("Should only extract from sections beginning with 'plugin.' in config", func(t *testing.T) {
		cfg := setting.NewCfg()
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

		ps := extractPluginSettings(cfg)
		require.Len(t, ps, 1)
		require.Len(t, ps["plugin"], 2)

		t.Run("Should skip path setting", func(t *testing.T) {
			_, err = sec.NewKey("path", "value")
			require.NoError(t, err)

			ps := extractPluginSettings(cfg)
			require.Len(t, ps["plugin"], 2)
		})

		t.Run("Should skip id setting", func(t *testing.T) {
			_, err = sec.NewKey("id", "value")
			require.NoError(t, err)

			ps := extractPluginSettings(cfg)
			require.Len(t, ps["plugin"], 2)
		})

		t.Run("Should return expected environment variables from plugin settings ", func(t *testing.T) {
			ps := extractPluginSettings(cfg)
			env := ps["plugin"].ToEnv("GF_PLUGIN", []string{"GF_VERSION=6.7.0"})
			sort.Strings(env)
			require.Len(t, env, 3)
			require.EqualValues(t, []string{"GF_PLUGIN_KEY1=value1", "GF_PLUGIN_KEY2=value2", "GF_VERSION=6.7.0"}, env)
		})
	})
}
