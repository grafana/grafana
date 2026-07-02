package pluginconfig

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestProvidePluginManagementConfig_canvasExternalPlugin(t *testing.T) {
	raw, err := ini.Load([]byte(`[plugins]`))
	require.NoError(t, err)
	cfg := setting.NewCfg()
	cfg.Raw = raw

	t.Run("sets canvas as_external when canvasExternalPlugin flag is enabled", func(t *testing.T) {
		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(featuremgmt.FlagCanvasExternalPlugin))
		require.NoError(t, err)
		require.Equal(t, "true", pCfg.PluginSettings["canvas"]["as_external"])
	})

	t.Run("does not set canvas as_external when canvasExternalPlugin flag is disabled", func(t *testing.T) {
		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.NotEqual(t, "true", pCfg.PluginSettings["canvas"]["as_external"])
	})
}

func TestPluginSettings(t *testing.T) {
	raw, err := ini.Load([]byte(`
		[plugins]
		test_key = 123

		[plugin.test-datasource]
		foo = 5m
		bar = something

		[plugin.secret-plugin]
		secret_key = secret
		normal_key = not a secret`))
	require.NoError(t, err)

	cfg := &setting.Cfg{Raw: raw}
	settings := &setting.OSSImpl{Cfg: cfg}

	ps := extractPluginSettings(settings)
	require.Len(t, ps, 2)
	require.Len(t, ps["test-datasource"], 2)
	require.Equal(t, ps["test-datasource"]["foo"], "5m")
	require.Equal(t, ps["test-datasource"]["bar"], "something")
	require.Len(t, ps["secret-plugin"], 2)
	require.Equal(t, ps["secret-plugin"]["secret_key"], "secret")
	require.Equal(t, ps["secret-plugin"]["normal_key"], "not a secret")
}
