package nats

import (
	"context"
	"fmt"

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
	if cfg.Auth.Mode == setting.NATSAuthModeTokenExchange && cfg.Auth.TokenExchangeEnabled() {
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

// AuthMode reports the explicitly selected connection auth mechanism.
func (c *Config) AuthMode() setting.NATSAuthMode { return c.cfg.Auth.Mode }

// exchangeAccessToken mints a fresh access token scoped to the configured
// audiences. Callers present the returned token as the NATS connect token; an
// external auth-callout service verifies it and grants the connection's
// permissions.
func (c *Config) exchangeAccessToken(ctx context.Context) (string, error) {
	if c.tokenExchanger == nil {
		return "", fmt.Errorf("nats token exchange is not configured")
	}
	resp, err := c.tokenExchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace: c.cfg.Auth.TokenExchangeNamespace,
		Audiences: c.cfg.Auth.TokenExchangeAudiences,
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
