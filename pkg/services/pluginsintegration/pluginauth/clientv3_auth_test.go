package pluginauth

import (
	"context"
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/plugin"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNewClientV3TokenExchanger(t *testing.T) {
	cfgWith := func(token, url string) *setting.Cfg {
		cfg := setting.NewCfg()
		section := cfg.Raw.Section("plugins")
		section.Key("v3_cap_token").SetValue(token)
		section.Key("v3_token_exchange_url").SetValue(url)
		return cfg
	}

	exchanger, err := NewClientV3TokenExchanger(cfgWith("cap-token", "https://auth.example.com/v1/sign-access-token"))
	require.NoError(t, err)
	require.NotNil(t, exchanger)

	_, err = NewClientV3TokenExchanger(cfgWith("cap-token", ""))
	require.ErrorContains(t, err, "must be set together")

	exchanger, err = NewClientV3TokenExchanger(cfgWith("", ""))
	require.NoError(t, err)
	require.Nil(t, exchanger)

	exchanger, err = NewClientV3TokenExchanger(nil)
	require.NoError(t, err)
	require.Nil(t, exchanger)

	t.Run("does not reuse Grafana's other service credentials", func(t *testing.T) {
		cfg := cfgWith("", "")
		grpcAuth := cfg.Raw.Section("grpc_client_authentication")
		grpcAuth.Key("token").SetValue("service-token")
		grpcAuth.Key("token_exchange_url").SetValue("https://auth.example.com/v1/sign-access-token")
		exchanger, err := NewClientV3TokenExchanger(cfg)
		require.NoError(t, err)
		require.Nil(t, exchanger)
	})
}

func TestClientV3TokenExchanger(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	configured := authnlib.NewStaticTokenExchanger("token")
	cfgFor := func(env string) *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.Env = env
		cfg.PluginSettings = config.PluginSettings{
			"insecure-app": {"insecure_skip_authentication": "true"},
		}
		return cfg
	}
	dev := cfgFor(setting.Dev)

	require.Equal(t, configured, exchangerFor(t, dev, "insecure-app", configured), "a configured exchanger always wins")

	local, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	require.Same(t, local, exchangerFor(t, dev, "other-app", nil), "without a configured exchanger, tokens are signed locally")
	require.Same(t, local, exchangerFor(t, cfgFor(setting.Prod), "other-app", nil), "local tokens do not need development mode")
	require.Nil(t, exchangerFor(t, nil, "other-app", nil), "without a configuration, Grafana does not sign plugin tokens")

	t.Run("not with a real JWKS URL", func(t *testing.T) {
		cfg := cfgFor(setting.Dev)
		cfg.ExtJWTAuth.JWKSUrl = "https://auth.example.com/v1/keys"
		require.Nil(t, exchangerFor(t, cfg, "other-app", nil))
		require.Equal(t, configured, exchangerFor(t, cfg, "other-app", configured))
	})
	t.Run("not when local plugin auth is disabled", func(t *testing.T) {
		disabled := func(env string) *setting.Cfg {
			cfg := cfgFor(env)
			cfg.Raw.Section("plugins").Key("enable_local_plugin_auth").SetValue("false")
			return cfg
		}
		require.Nil(t, exchangerFor(t, disabled(setting.Dev), "other-app", nil), "plugins get no keys to verify local tokens")
		require.Nil(t, exchangerFor(t, disabled(setting.Prod), "insecure-app", nil))
		require.Same(t, local, exchangerFor(t, disabled(setting.Dev), "insecure-app", nil),
			"a development plugin that skips verification still sees the caller, as before local signing")
		require.Equal(t, configured, exchangerFor(t, disabled(setting.Dev), "other-app", configured))
	})
	for _, key := range []string{plugin.EnvVarGrafanaJWKS, plugin.EnvVarGrafanaJWKSURL} {
		t.Run("not with "+key+" in the environment", func(t *testing.T) {
			t.Setenv(key, "from-host")
			require.Nil(t, exchangerFor(t, dev, "other-app", nil))
		})
	}
}

func TestInvalidClientV3TokenExchanger(t *testing.T) {
	cfgErr := errors.New("the access policy token and token exchange URL must be set together")
	invalid := InvalidClientV3TokenExchanger(cfgErr)

	_, err := invalid.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}})
	require.ErrorIs(t, err, cfgErr)
	require.ErrorContains(t, err, "misconfigured")

	// An invalid configuration must not fall back to local development tokens.
	dev := setting.NewCfg()
	dev.Env = setting.Dev
	dev.PluginSettings = config.PluginSettings{"insecure-app": {"insecure_skip_authentication": "true"}}
	require.Equal(t, invalid, exchangerFor(t, dev, "insecure-app", invalid))
}

func TestClientV3TokenExchangerWithoutAppManifests(t *testing.T) {
	// Without the appplugins.loadAppManifest feature toggle, requests to plugins
	// carry no identity, as before local signing, unless a development plugin
	// skips verification.
	cfg := setting.NewCfg()
	require.Nil(t, exchangerFor(t, cfg, "other-app", nil))

	cfg.Env = setting.Dev
	cfg.PluginSettings = config.PluginSettings{"insecure-app": {"insecure_skip_authentication": "true"}}
	local, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	require.Same(t, local, exchangerFor(t, cfg, "insecure-app", nil))
}

// exchangerFor returns the exchanger for pluginID with the local plugin auth
// decision for cfg, as Wire provides it.
func exchangerFor(t *testing.T, cfg *setting.Cfg, pluginID string, exchanger authnlib.TokenExchanger) authnlib.TokenExchanger {
	t.Helper()
	var pluginAuth *Config
	if cfg != nil {
		var err error
		pluginAuth, err = ProvideConfig(cfg)
		require.NoError(t, err)
	}
	return ClientV3TokenExchanger(cfg, pluginAuth, pluginID, exchanger)
}
