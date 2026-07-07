package nats

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

// Config is the runtime configuration a connection needs to dial NATS. It
// resolves URLs and dial options based on deployment mode (embedded or
// external). Its exported methods form the contract consumed by connection.
type Config struct {
	cfg    setting.NATSSettings
	server *Server
	// tokenExchanger is non-nil only when token-exchange auth is configured; it
	// mints the short-lived access token each connection presents. The authlib
	// client caches tokens internally, so exchanging per (re)connect is cheap.
	tokenExchanger authnlib.TokenExchanger
}

func newConfig(cfg setting.NATSSettings, server *Server) *Config {
	c := &Config{
		cfg:    cfg,
		server: server,
	}
	if cfg.Auth.TokenExchangeEnabled() {
		// NewTokenExchangeClient only errors when the token or URL is empty, and
		// TokenExchangeEnabled has already established both are set.
		c.tokenExchanger, _ = authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            cfg.Auth.TokenExchangeToken,
			TokenExchangeURL: cfg.Auth.TokenExchangeURL,
		})
	}
	return c
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

// audiencesFor returns the token-exchange audiences a role's connection should
// request. Per-role audiences let the auth-callout service derive least-privilege
// permissions from the token itself rather than a client-supplied hint.
func (c *Config) audiencesFor(role connRole) []string {
	switch role {
	case rolePublisher:
		return c.cfg.Auth.PublisherAudiences()
	case roleSubscriber:
		return c.cfg.Auth.SubscriberAudiences()
	default:
		return c.cfg.Auth.TokenExchangeAudiences
	}
}

// TokenExchangeConfiguredFor reports whether the given role's connection should
// present a minted access token: the exchanger was built successfully and the
// role resolves to at least one audience to request.
func (c *Config) TokenExchangeConfiguredFor(role connRole) bool {
	return c.tokenExchanger != nil && len(c.audiencesFor(role)) > 0
}

// exchangeAccessToken mints a fresh access token scoped to the given role's
// audiences. Callers present the returned token as the NATS connect token; an
// external auth-callout service verifies it and derives the connection's
// permissions from the token's audience.
func (c *Config) exchangeAccessToken(ctx context.Context, role connRole) (string, error) {
	resp, err := c.tokenExchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace: c.cfg.Auth.TokenExchangeNamespace,
		Audiences: c.audiencesFor(role),
	})
	if err != nil {
		return "", err
	}
	return resp.Token, nil
}

// PublisherCredentials returns the credentials file the publisher connection
// should use, falling back to the shared credentials when none is set.
func (c *Config) PublisherCredentials() string { return c.cfg.Auth.PublisherCredentials() }

// SubscriberCredentials returns the credentials file the subscriber connection
// should use, falling back to the shared credentials when none is set.
func (c *Config) SubscriberCredentials() string { return c.cfg.Auth.SubscriberCredentials() }

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
