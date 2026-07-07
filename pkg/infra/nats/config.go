package nats

import (
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

// Config is the runtime configuration a connection needs to dial NATS. It
// resolves URLs and dial options based on deployment mode (embedded or
// external). Its exported methods form the contract consumed by connection.
type Config struct {
	cfg    setting.NATSSettings
	server *Server
}

func newConfig(cfg setting.NATSSettings, server *Server) *Config {
	return &Config{
		cfg:    cfg,
		server: server,
	}
}

// ProvideNATSConfig builds the shared connection config from configuration and
// the Server that owns the embedded NATS lifecycle.
func ProvideNATSConfig(cfg *setting.Cfg, server *Server) *Config {
	return newConfig(cfg.NATS, server)
}

// Enabled reports whether NATS is turned on at all.
func (c *Config) Enabled() bool { return c.cfg.Enabled }

// TLS returns the client TLS configuration.
func (c *Config) TLS() setting.NATSTLSSettings { return c.cfg.TLS }

// Token returns the shared auth token, if any.
func (c *Config) Token() string { return c.cfg.Auth.Token }

func (c *Config) PublisherAuth() roleAuth {
	user, password := c.cfg.Auth.PublisherUserInfo()
	return roleAuth{
		credentialsFile: c.cfg.Auth.PublisherCredentials(),
		username:        user,
		password:        password,
	}
}

func (c *Config) SubscriberAuth() roleAuth {
	user, password := c.cfg.Auth.SubscriberUserInfo()
	return roleAuth{
		credentialsFile: c.cfg.Auth.SubscriberCredentials(),
		username:        user,
		password:        password,
	}
}

// URLs returns the client URLs known so far. In embedded mode the running
// server's local URL is prepended ahead of the configured peers. Safe for
// concurrent use.
func (c *Config) URLs() []string {
	if local := c.server.clientURL(); local != "" {
		return append([]string{local}, c.cfg.ClientURLs...)
	}
	return append([]string(nil), c.cfg.ClientURLs...)
}

// DialOptions returns extra dial options. In embedded mode this carries the
// in-process server hop so the local connection bypasses TCP/TLS. Safe for
// concurrent use.
func (c *Config) DialOptions() []natsclient.Option {
	return c.server.dialOptions()
}
