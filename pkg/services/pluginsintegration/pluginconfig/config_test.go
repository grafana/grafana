package pluginconfig

import (
	"net/url"
	"testing"
	"time"

	"gopkg.in/ini.v1"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
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

	pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
	require.NoError(t, err)
	require.Equal(t, openFeature, pluginCfg.OpenFeature)
}

func TestProvidePluginInstanceConfigLocalPluginTokens(t *testing.T) {
	for _, tc := range []struct {
		name, token, url, jwksURL string
		hostEnv                   string
		want                      bool
	}{
		{name: "no token exchange", want: true},
		{name: "token exchange", token: "cap-token", url: "https://auth.example.com/v1/sign-access-token", want: false},
		{name: "misconfigured token exchange", token: "cap-token", want: false},
		{name: "real JWKS URL", jwksURL: "https://auth.example.com/v1/keys", want: false},
		{name: "host " + v3.EnvVarSigningKeys, hostEnv: v3.EnvVarSigningKeys, want: false},
		{name: "host " + v3.EnvVarSigningKeysURL, hostEnv: v3.EnvVarSigningKeysURL, want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.hostEnv != "" {
				t.Setenv(tc.hostEnv, "from-host")
			}
			cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", Raw: ini.Empty(), ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: tc.jwksURL}}
			section := cfg.Raw.Section("plugins")
			section.Key("v3_cap_token").SetValue(tc.token)
			section.Key("v3_token_exchange_url").SetValue(tc.url)

			pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
			require.NoError(t, err)
			require.Equal(t, tc.want, pluginCfg.LocalPluginTokens)
		})
	}
}

func newTestServerConfig() *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.Protocol = setting.HTTPScheme
	cfg.HTTPPort = "3000"
	return cfg
}

func TestProvidePluginInstanceConfigLocalAPIURL(t *testing.T) {
	for _, tc := range []struct {
		name, override, jwksURL, want string
		wantError                     bool
	}{
		{name: "unsupported listener gets no API access", want: ""},
		{name: "explicit override", override: "https://grafana.internal:8443", want: "https://grafana.internal:8443"},
		{name: "invalid override", override: "/relative", wantError: true},
		{name: "external signer does not need local endpoint", jwksURL: "https://auth.example.com/keys"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := newTestServerConfig()
			cfg.Protocol = setting.HTTPSScheme
			cfg.ExtJWTAuth.JWKSUrl = tc.jwksURL
			cfg.Raw.Section("plugins").Key("local_api_url").SetValue(tc.override)
			pluginCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
			if tc.wantError {
				require.ErrorContains(t, err, "[plugins] local_api_url")
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, pluginCfg.LocalAPIURL)
		})
	}
}
