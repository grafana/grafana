package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestNATSEnabledDefaultFollowsTarget(t *testing.T) {
	// Turn the single-binary default on, as Grafana 14 will: module targets that
	// never set [nats] must still start, while explicit values keep winning.
	saved := natsEnabledDefault
	t.Cleanup(func() { natsEnabledDefault = saved })
	natsEnabledDefault = true

	cases := map[string]struct {
		args []string
		want bool
	}{
		"single binary":                     {nil, true},
		"core target":                       {[]string{"cfg:target=core"}, true},
		"storage-server target":             {[]string{"cfg:target=storage-server"}, false},
		"operator target":                   {[]string{"cfg:target=operator"}, false},
		"core with a module target":         {[]string{"cfg:target=core,storage-server"}, false},
		"module target explicitly enabled":  {[]string{"cfg:target=storage-server", "cfg:nats.enabled=true"}, true},
		"single binary explicitly disabled": {[]string{"cfg:nats.enabled=false"}, false},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			// Loads the shipped conf/defaults.ini, which must leave enabled empty
			// for the target to decide.
			cfg := NewCfg()
			require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../", Args: tc.args}))
			require.Equal(t, tc.want, cfg.NATS.Enabled)
		})
	}
}

func TestReadNATSSettings(t *testing.T) {
	t.Run("defaults when section absent", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte(""))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))

		require.True(t, cfg.NATS.Enabled)
		require.Equal(t, NATSModeEmbedded, cfg.NATS.Mode)
		require.True(t, cfg.NATS.Embedded())
		// The embedded server chooses the listen address when it is unset.
		require.Empty(t, cfg.NATS.ListenAddress)
		require.Equal(t, 4222, cfg.NATS.ClientPort)
		require.Equal(t, 6222, cfg.NATS.ClusterPort)
		require.Empty(t, cfg.NATS.ClientURLs)
		require.False(t, cfg.NATS.TLS.Enabled)
		require.Equal(t, NATSAuthModeNone, cfg.NATS.Auth.Mode)
		require.True(t, cfg.NATS.Notifier)
		require.Equal(t, time.Hour, cfg.NATS.NotifierWatchMaxAge)
		require.False(t, cfg.NATS.ClientListen)
		require.Equal(t, "127.0.0.1", cfg.NATS.ClientListenAddress)
		require.False(t, cfg.NATS.ClusterTLS.Enabled())
	})

	t.Run("parses client listen and cluster tls", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte(`
[nats]
enabled = true
client_listen = true
client_listen_address = 10.0.0.7
cluster_tls_cert_path = /etc/nats/tls.crt
cluster_tls_key_path = /etc/nats/tls.key
cluster_tls_ca_path = /etc/nats/ca.crt
`))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))

		require.True(t, cfg.NATS.ClientListen)
		require.Equal(t, "10.0.0.7", cfg.NATS.ClientListenAddress)
		require.True(t, cfg.NATS.ClusterTLS.Enabled())
		require.Equal(t, NATSClusterTLSSettings{
			CertPath: "/etc/nats/tls.crt",
			KeyPath:  "/etc/nats/tls.key",
			CAPath:   "/etc/nats/ca.crt",
		}, cfg.NATS.ClusterTLS)
	})

	t.Run("keeps an explicit listen address and an empty one unset", func(t *testing.T) {
		for raw, want := range map[string]string{
			"listen_address = 10.0.0.5\n": "10.0.0.5",
			"listen_address =\n":          "",
		} {
			cfg := NewCfg()
			f, err := ini.Load([]byte("[nats]\n" + raw))
			require.NoError(t, err)
			cfg.Raw = f

			require.NoError(t, readNATSSettings(cfg))
			require.Equal(t, want, cfg.NATS.ListenAddress)
		}
	})

	t.Run("rejects a partial cluster tls configuration", func(t *testing.T) {
		cases := map[string]string{
			"cert only":    "cluster_tls_cert_path = /c\n",
			"cert and key": "cluster_tls_cert_path = /c\ncluster_tls_key_path = /k\n",
			"ca only":      "cluster_tls_ca_path = /ca\n",
			"key and ca":   "cluster_tls_key_path = /k\ncluster_tls_ca_path = /ca\n",
		}
		for name, keys := range cases {
			t.Run(name, func(t *testing.T) {
				cfg := NewCfg()
				f, err := ini.Load([]byte("[nats]\nenabled = true\n" + keys))
				require.NoError(t, err)
				cfg.Raw = f

				require.ErrorContains(t, readNATSSettings(cfg), "cluster tls requires")
			})
		}
	})

	t.Run("ignores cluster tls outside an enabled embedded server", func(t *testing.T) {
		for _, raw := range []string{
			"[nats]\nenabled = false\ncluster_tls_cert_path = /c\n",
			"[nats]\nenabled = true\nmode = external\nclient_urls = nats://a:4222\ncluster_tls_cert_path = /c\n",
		} {
			cfg := NewCfg()
			f, err := ini.Load([]byte(raw))
			require.NoError(t, err)
			cfg.Raw = f

			require.NoError(t, readNATSSettings(cfg))
		}
	})

	t.Run("notifier defaults follow enabled", func(t *testing.T) {
		cases := map[string]struct {
			raw         string
			notifier    bool
			watchMaxAge time.Duration
		}{
			// Empty values are what conf/defaults.ini ships.
			"disabled with empty defaults": {"[nats]\nenabled = false\nnotifier =\nnotifier_watch_max_age =\n", false, 0},
			"enabled with empty defaults":  {"[nats]\nenabled = true\nnotifier =\nnotifier_watch_max_age =\n", true, time.Hour},
			"enabled only":                 {"[nats]\nenabled = true\n", true, time.Hour},
			"enabled, notifier off":        {"[nats]\nenabled = true\nnotifier = false\n", false, 0},
			"enabled, max age set":         {"[nats]\nenabled = true\nnotifier_watch_max_age = 5m\n", true, 5 * time.Minute},
			"enabled, max age off":         {"[nats]\nenabled = true\nnotifier_watch_max_age = 0\n", true, 0},
			"disabled, notifier set":       {"[nats]\nenabled = false\nnotifier = true\n", true, 0},
			"enabled, shadow only":         {"[nats]\nenabled = true\nnotifier_shadow = true\n", false, 0},
			"enabled, shadow and notifier": {"[nats]\nenabled = true\nnotifier_shadow = true\nnotifier = true\n", true, time.Hour},
		}
		for name, tc := range cases {
			t.Run(name, func(t *testing.T) {
				cfg := NewCfg()
				f, err := ini.Load([]byte(tc.raw))
				require.NoError(t, err)
				cfg.Raw = f

				require.NoError(t, readNATSSettings(cfg))

				require.Equal(t, tc.notifier, cfg.NATS.Notifier)
				require.Equal(t, tc.watchMaxAge, cfg.NATS.NotifierWatchMaxAge)
			})
		}
	})

	t.Run("parses notifier watch max age", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte("[nats]\nnotifier = true\nnotifier_watch_max_age = 5m\n"))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))

		require.True(t, cfg.NATS.Notifier)
		require.Equal(t, 5*time.Minute, cfg.NATS.NotifierWatchMaxAge)
	})

	t.Run("parses overrides", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte(`
[nats]
enabled = true
mode = external
client_urls = nats://a:4222, nats://b:4222
tls_enabled = true
tls_ca_cert_path = /etc/ca.pem
auth_mode = token_exchange
token = s3cret
publisher_credentials_file = /etc/pub.creds
subscriber_credentials_file = /etc/sub.creds
token_exchange_audiences = us-nats, other

[grpc_client_authentication]
token = boot-token
token_exchange_url = http://signer/sign
token_namespace = *
`))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))

		require.True(t, cfg.NATS.Enabled)
		require.Equal(t, NATSModeExternal, cfg.NATS.Mode)
		require.False(t, cfg.NATS.Embedded())
		require.Equal(t, []string{"nats://a:4222", "nats://b:4222"}, cfg.NATS.ClientURLs)
		require.True(t, cfg.NATS.TLS.Enabled)
		require.Equal(t, "/etc/ca.pem", cfg.NATS.TLS.CACertPath)
		require.Equal(t, NATSAuthModeTokenExchange, cfg.NATS.Auth.Mode)
		require.Equal(t, "s3cret", cfg.NATS.Auth.Token)
		require.Equal(t, "/etc/pub.creds", cfg.NATS.Auth.PublisherCredentialsFile)
		require.Equal(t, "/etc/sub.creds", cfg.NATS.Auth.SubscriberCredentialsFile)

		// Token exchange: audiences come from [nats]; endpoint/token/namespace are
		// shared with [grpc_client_authentication].
		require.Equal(t, []string{"us-nats", "other"}, cfg.NATS.Auth.TokenExchangeAudiences)
		require.Equal(t, "http://signer/sign", cfg.NATS.Auth.TokenExchangeURL)
		require.Equal(t, "boot-token", cfg.NATS.Auth.TokenExchangeToken)
		require.Equal(t, "*", cfg.NATS.Auth.TokenExchangeNamespace)
		require.True(t, cfg.NATS.Auth.TokenExchangeEnabled())
	})

	t.Run("rejects invalid mode", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte("[nats]\nmode = bogus\n"))
		require.NoError(t, err)
		cfg.Raw = f

		require.Error(t, readNATSSettings(cfg))
	})

	t.Run("rejects invalid auth_mode even when disabled", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte("[nats]\nauth_mode = bogus\n"))
		require.NoError(t, err)
		cfg.Raw = f

		require.Error(t, readNATSSettings(cfg))
	})

	t.Run("rejects enabled auth_mode missing its required fields", func(t *testing.T) {
		cases := map[string]string{
			"token without token":              "[nats]\nenabled = true\nauth_mode = token\n",
			"credentials without a creds file": "[nats]\nenabled = true\nauth_mode = credentials\n",
			"token_exchange without audiences": "[nats]\nenabled = true\nauth_mode = token_exchange\n",
		}
		for name, raw := range cases {
			t.Run(name, func(t *testing.T) {
				cfg := NewCfg()
				f, err := ini.Load([]byte(raw))
				require.NoError(t, err)
				cfg.Raw = f

				require.Error(t, readNATSSettings(cfg))
			})
		}
	})

	t.Run("does not require auth fields when disabled", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte("[nats]\nenabled = false\nauth_mode = token\n"))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))
	})
}

func TestNATSAuthValidate(t *testing.T) {
	t.Run("credentials mode accepts per-role files without a shared file", func(t *testing.T) {
		a := NATSAuthSettings{
			Mode:                      NATSAuthModeCredentials,
			PublisherCredentialsFile:  "/pub.creds",
			SubscriberCredentialsFile: "/sub.creds",
		}
		require.NoError(t, a.validate(true))
	})

	t.Run("credentials mode rejects a single per-role file", func(t *testing.T) {
		a := NATSAuthSettings{Mode: NATSAuthModeCredentials, PublisherCredentialsFile: "/pub.creds"}
		require.Error(t, a.validate(true))
	})

	t.Run("credentials mode accepts a shared file for both roles", func(t *testing.T) {
		a := NATSAuthSettings{Mode: NATSAuthModeCredentials, CredentialsFile: "/shared.creds"}
		require.NoError(t, a.validate(true))
	})
}

func TestNATSAuthCredentialsPrecedence(t *testing.T) {
	t.Run("per-role overrides shared", func(t *testing.T) {
		a := NATSAuthSettings{
			CredentialsFile:          "/shared.creds",
			PublisherCredentialsFile: "/pub.creds",
		}
		require.Equal(t, "/pub.creds", a.PublisherCredentials())
	})

	t.Run("falls back to shared", func(t *testing.T) {
		a := NATSAuthSettings{CredentialsFile: "/shared.creds"}
		require.Equal(t, "/shared.creds", a.PublisherCredentials())
	})

	t.Run("empty when nothing set", func(t *testing.T) {
		a := NATSAuthSettings{}
		require.Empty(t, a.PublisherCredentials())
	})

	t.Run("subscriber per-role overrides shared", func(t *testing.T) {
		a := NATSAuthSettings{
			CredentialsFile:           "/shared.creds",
			SubscriberCredentialsFile: "/sub.creds",
		}
		require.Equal(t, "/sub.creds", a.SubscriberCredentials())
	})

	t.Run("subscriber falls back to shared", func(t *testing.T) {
		a := NATSAuthSettings{CredentialsFile: "/shared.creds"}
		require.Equal(t, "/shared.creds", a.SubscriberCredentials())
	})

	t.Run("subscriber empty when nothing set", func(t *testing.T) {
		a := NATSAuthSettings{}
		require.Empty(t, a.SubscriberCredentials())
	})
}

func TestNATSAuthTokenExchangeEnabled(t *testing.T) {
	base := NATSAuthSettings{
		TokenExchangeAudiences: []string{"us-nats"},
		TokenExchangeURL:       "http://signer/sign",
		TokenExchangeToken:     "boot-token",
	}

	t.Run("enabled when audience, url and token are set", func(t *testing.T) {
		require.True(t, base.TokenExchangeEnabled())
	})

	t.Run("disabled without audiences", func(t *testing.T) {
		a := base
		a.TokenExchangeAudiences = nil
		require.False(t, a.TokenExchangeEnabled())
	})

	t.Run("disabled without exchange url", func(t *testing.T) {
		a := base
		a.TokenExchangeURL = ""
		require.False(t, a.TokenExchangeEnabled())
	})

	t.Run("disabled without bootstrap token", func(t *testing.T) {
		a := base
		a.TokenExchangeToken = ""
		require.False(t, a.TokenExchangeEnabled())
	})
}
