package pluginconfig

import (
	"net/url"
	"testing"
	"time"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

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

	cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", Raw: raw}
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
	cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000",
		Raw:                         ini.Empty(),
		MarketplaceLicenseDirectory: "/var/lib/grafana/marketplace-licenses",
	}

	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(), nil)
	require.NoError(t, err)
	require.Equal(t, cfg.MarketplaceLicenseDirectory, pluginCfg.MarketplaceLicenseDirectory)
}

func TestProvidePluginInstanceConfigOpenFeature(t *testing.T) {
	u, err := url.Parse("http://features.example.com:1031")
	require.NoError(t, err)

	openFeature := setting.OpenFeatureSettings{
		ProviderType: setting.OFREPProviderType,
		URL:          u,
		TargetingKey: "stacks-123",
		ContextAttrs: map[string]string{"namespace": "stacks-123"},
		CacheTTL:     time.Minute,
	}
	cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000",
		Raw:         ini.Empty(),
		OpenFeature: openFeature,
	}

	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(), nil)
	require.NoError(t, err)
	require.Equal(t, openFeature, pluginCfg.OpenFeature)
}

func newTestServerConfig() *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.Protocol = setting.HTTPScheme
	cfg.HTTPPort = "3000"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	return cfg
}

func TestProvidePluginInstanceConfigPluginAuth(t *testing.T) {
	cfg := newTestServerConfig()
	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(),
		&pluginauth.Config{Enabled: true, APIURL: "http://127.0.0.1:3000", LoopbackOnly: true})
	require.NoError(t, err)
	require.True(t, pluginCfg.LocalPluginTokens)
	require.Equal(t, "http://127.0.0.1:3000", pluginCfg.LocalAPIURL)

	pluginCfg, err = ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures(), nil)
	require.NoError(t, err)
	require.False(t, pluginCfg.LocalPluginTokens, "without a decision, Grafana does not sign plugin tokens")
	require.Empty(t, pluginCfg.LocalAPIURL)
}
