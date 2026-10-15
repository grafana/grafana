package appplugin

import (
	"context"
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/config"
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

	require.Equal(t, configured, ClientV3TokenExchanger(dev, "insecure-app", configured), "a configured exchanger always wins")

	local, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	require.Same(t, local, ClientV3TokenExchanger(dev, "other-app", nil), "without a configured exchanger, tokens are signed locally")
	require.Same(t, local, ClientV3TokenExchanger(cfgFor(setting.Prod), "other-app", nil), "local tokens do not need development mode")
	require.Same(t, local, ClientV3TokenExchanger(nil, "other-app", nil))
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
	require.Equal(t, invalid, ClientV3TokenExchanger(dev, "insecure-app", invalid))
}
