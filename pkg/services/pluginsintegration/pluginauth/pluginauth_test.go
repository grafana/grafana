package pluginauth

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLocalAPIURL(t *testing.T) {
	for _, tc := range []struct {
		name string
		cfg  setting.Cfg
		want string
	}{
		{name: "configured port", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "4321"}, want: "http://127.0.0.1:4321"},
		{name: "all interfaces", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "0.0.0.0", HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "unset address", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "all IPv6 interfaces", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "::", HTTPPort: "3000"}, want: "http://127.0.0.1:3000"},
		{name: "loopback", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "127.0.0.1", HTTPPort: "3001"}, want: "http://127.0.0.1:3001"},
		{name: "IPv6 loopback", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "::1", HTTPPort: "3000"}, want: "http://[::1]:3000"},
		{name: "localhost", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "localhost", HTTPPort: "3000"}, want: "http://localhost:3000"},
		{name: "served from a sub path", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", AppSubURL: "/grafana", ServeFromSubPath: true}, want: "http://127.0.0.1:3000/grafana"},
		{name: "sub path stripped by a proxy", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", AppSubURL: "/grafana"}, want: "http://127.0.0.1:3000"},
		{name: "another address", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "10.0.0.5", HTTPPort: "3000"}},
		{name: "HTTPS", cfg: setting.Cfg{Protocol: setting.HTTPSScheme, HTTPPort: "3000"}},
		{name: "HTTP/2", cfg: setting.Cfg{Protocol: setting.HTTP2Scheme, HTTPPort: "3000"}},
		{name: "socket", cfg: setting.Cfg{Protocol: setting.SocketScheme}},
		{name: "bracketed IPv6 loopback", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPAddr: "[::1]", HTTPPort: "4321"}, want: "http://[::1]:4321"},
		{name: "enforced public domain", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "4321", EnforceDomain: true, Domain: "grafana.example.com"}},
		{name: "enforced loopback domain", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "4321", EnforceDomain: true, Domain: "127.0.0.1"}, want: "http://127.0.0.1:4321"},
		{name: "random port", cfg: setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "0"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.cfg.ExtJWTAuth.Audiences == nil {
				tc.cfg.ExtJWTAuth.Audiences = []string{"grafana"}
			}
			got, err := localAPIURL(&tc.cfg)
			if tc.want == "" {
				require.ErrorIs(t, err, errNoLocalAPIURL, "an unsupported listener disables plugin API access instead of failing startup")
				require.ErrorContains(t, err, "[plugins] local_api_url")
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.want, got)
		})
	}
	_, err := localAPIURL(nil)
	require.ErrorIs(t, err, errNoLocalAPIURL)
}

func TestLocalAPIURLOverride(t *testing.T) {
	for _, tc := range []struct {
		name, endpoint, domain, wantError string
	}{
		{name: "explicit port and subpath", endpoint: "https://grafana.internal:8443/grafana/"},
		{name: "standard HTTPS port", endpoint: "https://grafana.internal"},
		{name: "specific interface", endpoint: "http://10.0.0.5:4321"},
		{name: "IPv6", endpoint: "http://[::1]:4321/"},
		{name: "matching enforced domain", endpoint: "https://grafana.internal:8443", domain: "GRAFANA.INTERNAL"},
		{name: "enforced domain redirect", endpoint: "http://127.0.0.1:4321", domain: "grafana.internal", wantError: "enforce_domain"},
		{name: "relative URL", endpoint: "/grafana", wantError: "absolute HTTP(S)"},
		{name: "missing host", endpoint: "http:///grafana", wantError: "absolute HTTP(S)"},
		{name: "unsupported scheme", endpoint: "ftp://grafana.internal", wantError: "absolute HTTP(S)"},
		{name: "malformed URL", endpoint: "http://[", wantError: "absolute HTTP(S)"},
		{name: "userinfo", endpoint: "http://user:password@grafana.internal", wantError: "without credentials"},
		{name: "query", endpoint: "http://grafana.internal?x=1", wantError: "without credentials"},
		{name: "empty query", endpoint: "http://grafana.internal?", wantError: "without credentials"},
		{name: "fragment", endpoint: "http://grafana.internal#x", wantError: "without credentials"},
		{name: "empty fragment", endpoint: "http://grafana.internal#", wantError: "without credentials"},
		{name: "zero port", endpoint: "http://grafana.internal:0", wantError: "invalid port"},
		{name: "out of range port", endpoint: "http://grafana.internal:65536", wantError: "invalid port"},
		{name: "empty port", endpoint: "http://grafana.internal:", wantError: "invalid port"},
		{name: "wildcard address", endpoint: "http://0.0.0.0:3000", wantError: "wildcard listen address"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{Raw: ini.Empty(), Protocol: setting.HTTPSScheme, HTTPPort: "4321", AppSubURL: "/other", ServeFromSubPath: true, Domain: tc.domain, EnforceDomain: tc.domain != "",
				ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}
			cfg.Raw.Section("plugins").Key("local_api_url").SetValue(tc.endpoint)
			got, err := localAPIURL(cfg)
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				require.NotErrorIs(t, err, errNoLocalAPIURL, "an invalid override fails startup")
				require.Empty(t, got)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.endpoint, got, "the override keeps its own port and path")
		})
	}
}

func TestLocalAPIURLOverrideFromEnvironment(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	cfg.Protocol = setting.SocketScheme
	cfg.Raw.Section("plugins").Key("local_api_url").SetValue("http://old:1234")
	t.Setenv("GF_PLUGINS_LOCAL_API_URL", "http://127.0.0.1:4321")
	got, err := localAPIURL(cfg)
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:4321", got)
}

func TestLocalAPIURLRequiresGrafanaAudience(t *testing.T) {
	for _, audiences := range [][]string{nil, {"custom"}} {
		cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", ExtJWTAuth: setting.ExtJWTSettings{Audiences: audiences}}
		got, err := localAPIURL(cfg)
		require.ErrorIs(t, err, errNoLocalAPIURL, "plugins would get credentials Grafana's API never accepts")
		require.Empty(t, got)
	}
}

func TestLocalPluginAuthEnabled(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfgWith := func(enabled string) *setting.Cfg {
		cfg := &setting.Cfg{Raw: ini.Empty()}
		if enabled != "" {
			cfg.Raw.Section("plugins").Key("enable_local_plugin_auth").SetValue(enabled)
		}
		return cfg
	}
	require.True(t, localPluginAuthEnabled(cfgWith("")), "on by default without a token signer")
	require.True(t, localPluginAuthEnabled(cfgWith("true")))
	require.False(t, localPluginAuthEnabled(cfgWith("false")))
	require.False(t, localPluginAuthEnabled(nil))

	// A loaded configuration, which logs the environment override it applies.
	cfg := setting.NewCfg()
	cfg.Raw.Section("plugins").Key("enable_local_plugin_auth").SetValue("true")
	t.Setenv("GF_PLUGINS_ENABLE_LOCAL_PLUGIN_AUTH", "false")
	require.False(t, localPluginAuthEnabled(cfg), "the environment overrides the file")
}

func TestLocalPluginAuthRequiresAppManifests(t *testing.T) {
	// Without the appplugins.loadAppManifest feature toggle, the default.
	require.False(t, localPluginAuthEnabled(&setting.Cfg{Raw: ini.Empty()}))

	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	require.True(t, localPluginAuthEnabled(&setting.Cfg{Raw: ini.Empty()}))
}

func TestProvideConfig(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfgWith := func(protocol setting.Scheme, override string) *setting.Cfg {
		cfg := &setting.Cfg{Raw: ini.Empty(), Protocol: protocol, HTTPPort: "3000", ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}
		cfg.Raw.Section("plugins").Key("local_api_url").SetValue(override)
		return cfg
	}

	t.Run("derived loopback URL", func(t *testing.T) {
		c, err := ProvideConfig(cfgWith(setting.HTTPScheme, ""))
		require.NoError(t, err)
		require.Equal(t, &Config{Enabled: true, APIURL: "http://127.0.0.1:3000", LoopbackOnly: true}, c)
	})
	t.Run("explicit non-loopback URL", func(t *testing.T) {
		c, err := ProvideConfig(cfgWith(setting.HTTPSScheme, "https://grafana.internal:8443"))
		require.NoError(t, err)
		require.Equal(t, &Config{Enabled: true, APIURL: "https://grafana.internal:8443"}, c)
	})
	t.Run("no URL leaves plugins without API credentials", func(t *testing.T) {
		c, err := ProvideConfig(cfgWith(setting.HTTPSScheme, ""))
		require.NoError(t, err)
		require.Equal(t, &Config{Enabled: true}, c)
	})
	t.Run("an invalid override fails startup", func(t *testing.T) {
		_, err := ProvideConfig(cfgWith(setting.HTTPScheme, "/relative"))
		require.ErrorContains(t, err, "[plugins] local_api_url")
	})
	t.Run("disabled", func(t *testing.T) {
		cfg := cfgWith(setting.HTTPScheme, "")
		cfg.Raw.Section("plugins").Key("enable_local_plugin_auth").SetValue("false")
		c, err := ProvideConfig(cfg)
		require.NoError(t, err)
		require.Equal(t, &Config{}, c)
	})
	t.Run("nil config", func(t *testing.T) {
		var c *Config
		require.False(t, c.LocalTokens())
		require.Empty(t, c.LocalAPIURL())
	})
}

func TestProvideConfigDecision(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	for _, tc := range []struct {
		name, token, url, jwksURL string
		hostEnv                   string
		disabled                  bool
		want                      bool
	}{
		{name: "no token exchange", want: true},
		{name: "local plugin auth disabled", disabled: true, want: false},
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
			cfg := &setting.Cfg{Protocol: setting.HTTPScheme, HTTPPort: "3000", Raw: ini.Empty(), ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: tc.jwksURL, Audiences: []string{"grafana"}}}
			section := cfg.Raw.Section("plugins")
			section.Key("v3_cap_token").SetValue(tc.token)
			section.Key("v3_token_exchange_url").SetValue(tc.url)
			if tc.disabled {
				section.Key("enable_local_plugin_auth").SetValue("false")
			}
			c, err := ProvideConfig(cfg)
			require.NoError(t, err)
			require.Equal(t, tc.want, c.Enabled)
			if !tc.want {
				require.Empty(t, c.APIURL, "plugins get no API credentials without local signing")
			}
		})
	}
}
