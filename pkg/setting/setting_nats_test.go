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
token = s3cret
publisher_credentials_file = /etc/pub.creds
subscriber_credentials_file = /etc/sub.creds
token_exchange_audiences = us-nats, other
publisher_token_exchange_audiences = us-nats-publish
subscriber_token_exchange_audiences = us-nats-subscribe

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
		require.Equal(t, "s3cret", cfg.NATS.Auth.Token)
		require.Equal(t, "/etc/pub.creds", cfg.NATS.Auth.PublisherCredentialsFile)
		require.Equal(t, "/etc/sub.creds", cfg.NATS.Auth.SubscriberCredentialsFile)

		// Token exchange: audiences come from [nats]; endpoint/token/namespace are
		// shared with [grpc_client_authentication].
		require.Equal(t, []string{"us-nats", "other"}, cfg.NATS.Auth.TokenExchangeAudiences)
		require.Equal(t, []string{"us-nats-publish"}, cfg.NATS.Auth.PublisherTokenExchangeAudiences)
		require.Equal(t, []string{"us-nats-subscribe"}, cfg.NATS.Auth.SubscriberTokenExchangeAudiences)
		require.Equal(t, []string{"us-nats-publish"}, cfg.NATS.Auth.PublisherAudiences())
		require.Equal(t, []string{"us-nats-subscribe"}, cfg.NATS.Auth.SubscriberAudiences())
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

func TestNATSAuthAudiences(t *testing.T) {
	t.Run("per-role overrides shared", func(t *testing.T) {
		a := NATSAuthSettings{
			TokenExchangeAudiences:          []string{"shared"},
			PublisherTokenExchangeAudiences: []string{"us-nats-publish"},
		}
		require.Equal(t, []string{"us-nats-publish"}, a.PublisherAudiences())
	})

	t.Run("falls back to shared audiences", func(t *testing.T) {
		a := NATSAuthSettings{TokenExchangeAudiences: []string{"shared"}}
		require.Equal(t, []string{"shared"}, a.PublisherAudiences())
		require.Equal(t, []string{"shared"}, a.SubscriberAudiences())
	})

	t.Run("subscriber per-role overrides shared", func(t *testing.T) {
		a := NATSAuthSettings{
			TokenExchangeAudiences:           []string{"shared"},
			SubscriberTokenExchangeAudiences: []string{"us-nats-subscribe"},
		}
		require.Equal(t, []string{"us-nats-subscribe"}, a.SubscriberAudiences())
	})

	t.Run("empty when nothing set", func(t *testing.T) {
		a := NATSAuthSettings{}
		require.Empty(t, a.PublisherAudiences())
		require.Empty(t, a.SubscriberAudiences())
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

	t.Run("enabled via per-role audiences only", func(t *testing.T) {
		a := base
		a.TokenExchangeAudiences = nil
		a.PublisherTokenExchangeAudiences = []string{"us-nats-publish"}
		require.True(t, a.TokenExchangeEnabled())
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
