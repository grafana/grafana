package router

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestParsePluginGRPCConfig(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(setting.NewCfg())
		require.NoError(t, err)
		require.Equal(t, defaultPluginGRPCConfig(), cfg)
	})

	t.Run("configured", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{
			"retry_max":     "3",
			"retry_backoff": "1s",
			"retry_jitter":  "0.5",
		}))
		require.NoError(t, err)
		require.Equal(t, pluginGRPCRetryConfig{Max: 3, Backoff: time.Second, Jitter: 0.5}, cfg.Retry)
	})

	for key, value := range map[string]string{
		"retry_max":     "-1",
		"retry_backoff": "soon",
		"retry_jitter":  "1.5",
	} {
		t.Run("invalid "+key, func(t *testing.T) {
			cfg := cfgWithBackendGRPCSection(t, map[string]string{key: value})
			cfg.Raw.Section(cloudRouterSection).Key("plugins_url").SetValue("http://plugins.invalid/plugins")
			_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
			require.ErrorContains(t, err, backendGRPCSection+": "+key+" must be")
		})
	}
}

func cfgWithBackendGRPCSection(t *testing.T, kv map[string]string) *setting.Cfg {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(backendGRPCSection)
	require.NoError(t, err)
	for key, value := range kv {
		_, err := section.NewKey(key, value)
		require.NoError(t, err)
	}
	return cfg
}
