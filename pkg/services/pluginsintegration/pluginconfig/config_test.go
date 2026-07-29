package pluginconfig

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestProvidePluginManagementConfig_canvasExternalPlugin(t *testing.T) {
	t.Run("populates ActiveExternalOverrides when both as_external and alias_ids are configured in ini", func(t *testing.T) {
		raw, err := ini.Load([]byte(`
[plugins]
preinstall = grafana-canvas-panel

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Len(t, pCfg.ActiveExternalOverrides, 1)
		require.Equal(t, "canvas", pCfg.ActiveExternalOverrides[0].CorePluginID)
		require.Equal(t, "grafana-canvas-panel", pCfg.ActiveExternalOverrides[0].ExternalPluginID)
	})

	t.Run("has no active overrides when neither key is configured", func(t *testing.T) {
		raw, err := ini.Load([]byte(`[plugins]`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Empty(t, pCfg.ActiveExternalOverrides)
	})

	t.Run("has no active overrides when alias_ids is set but as_external is not", func(t *testing.T) {
		raw, err := ini.Load([]byte(`
[plugins]

[plugin.grafana-canvas-panel]
alias_ids = canvas`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Empty(t, pCfg.ActiveExternalOverrides)
	})

	t.Run("has no active overrides when as_external is set but alias_ids is not", func(t *testing.T) {
		raw, err := ini.Load([]byte(`
[plugins]

[plugin.canvas]
as_external = true`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Empty(t, pCfg.ActiveExternalOverrides)
	})

	t.Run("alias_ids with multiple entries including canvas activates the override", func(t *testing.T) {
		raw, err := ini.Load([]byte(`
[plugins]
preinstall = grafana-canvas-panel

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas, some-old-id`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Len(t, pCfg.ActiveExternalOverrides, 1)
	})

	t.Run("logs warning when override is active but external plugin is not in preinstall list", func(t *testing.T) {
		raw, err := ini.Load([]byte(`
[plugins]

[plugin.canvas]
as_external = true

[plugin.grafana-canvas-panel]
alias_ids = canvas`))
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.Raw = raw

		pCfg, err := ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		require.Len(t, pCfg.ActiveExternalOverrides, 1, "override should still be active despite missing preinstall")
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

func TestProvidePluginInstanceConfigMarketplaceLicenseDirectory(t *testing.T) {
	cfg := &setting.Cfg{
		Raw:                         ini.Empty(),
		MarketplaceLicenseDirectory: "/var/lib/grafana/marketplace-licenses",
	}

	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
	require.NoError(t, err)
	require.Equal(t, cfg.MarketplaceLicenseDirectory, pluginCfg.MarketplaceLicenseDirectory)
}
