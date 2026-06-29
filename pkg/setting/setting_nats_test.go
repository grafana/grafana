package setting

import (
	"testing"
	"time"

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
		require.Equal(t, "auto", cfg.NATS.Discovery)
		require.Equal(t, 30*time.Second, cfg.NATS.DiscoveryInterval)
		require.Equal(t, 5*time.Minute, cfg.NATS.DiscoveryTTL)
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
			CredentialsFile:           "/shared.creds",
			PublisherCredentialsFile:  "/pub.creds",
			SubscriberCredentialsFile: "/sub.creds",
		}
		require.Equal(t, "/pub.creds", a.PublisherCredentials())
		require.Equal(t, "/sub.creds", a.SubscriberCredentials())
	})

	t.Run("falls back to shared", func(t *testing.T) {
		a := NATSAuthSettings{CredentialsFile: "/shared.creds"}
		require.Equal(t, "/shared.creds", a.PublisherCredentials())
		require.Equal(t, "/shared.creds", a.SubscriberCredentials())
	})

	t.Run("empty when nothing set", func(t *testing.T) {
		a := NATSAuthSettings{}
		require.Empty(t, a.PublisherCredentials())
		require.Empty(t, a.SubscriberCredentials())
	})
}
