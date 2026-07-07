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
publisher_username = pub
publisher_password = pubpw
subscriber_username = sub
subscriber_password = subpw
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
		require.Equal(t, "pub", cfg.NATS.Auth.PublisherUsername)
		require.Equal(t, "pubpw", cfg.NATS.Auth.PublisherPassword)
		require.Equal(t, "sub", cfg.NATS.Auth.SubscriberUsername)
		require.Equal(t, "subpw", cfg.NATS.Auth.SubscriberPassword)
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

func TestNATSAuthUserInfoPrecedence(t *testing.T) {
	t.Run("per-role overrides shared as a pair", func(t *testing.T) {
		a := NATSAuthSettings{
			Username:          "shared",
			Password:          "sharedpw",
			PublisherUsername: "pub",
			PublisherPassword: "pubpw",
		}
		user, pass := a.PublisherUserInfo()
		require.Equal(t, "pub", user)
		require.Equal(t, "pubpw", pass)
	})

	t.Run("falls back to shared as a pair", func(t *testing.T) {
		a := NATSAuthSettings{Username: "shared", Password: "sharedpw"}
		user, pass := a.SubscriberUserInfo()
		require.Equal(t, "shared", user)
		require.Equal(t, "sharedpw", pass)
	})

	t.Run("per-role username uses its own password, never the shared one", func(t *testing.T) {
		a := NATSAuthSettings{
			Password:          "sharedpw",
			PublisherUsername: "pub",
		}
		user, pass := a.PublisherUserInfo()
		require.Equal(t, "pub", user)
		require.Empty(t, pass)
	})

	t.Run("empty when nothing set", func(t *testing.T) {
		a := NATSAuthSettings{}
		user, pass := a.SubscriberUserInfo()
		require.Empty(t, user)
		require.Empty(t, pass)
	})
}
