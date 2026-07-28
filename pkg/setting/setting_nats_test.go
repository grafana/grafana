package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadNATSSettings(t *testing.T) {
	t.Run("defaults when section absent", func(t *testing.T) {
		cfg := NewCfg()
		f, err := ini.Load([]byte(""))
		require.NoError(t, err)
		cfg.Raw = f

		require.NoError(t, readNATSSettings(cfg))

		require.False(t, cfg.NATS.Enabled)
		require.Equal(t, NATSModeEmbedded, cfg.NATS.Mode)
		require.True(t, cfg.NATS.Embedded())
		require.Equal(t, "127.0.0.1", cfg.NATS.ListenAddress)
		require.Equal(t, 4222, cfg.NATS.ClientPort)
		require.Equal(t, 6222, cfg.NATS.ClusterPort)
		require.Empty(t, cfg.NATS.ClientURLs)
		require.False(t, cfg.NATS.TLS.Enabled)
		require.Equal(t, NATSAuthModeNone, cfg.NATS.Auth.Mode)
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
