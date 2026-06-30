package nats

import (
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

// endpoints resolves NATS URLs and dial options based on deployment mode (embedded or external).
type endpoints struct {
	cfg  setting.NATSSettings
	urls []string

	server *Server
}

func newEndpoints(cfg setting.NATSSettings, server *Server) *endpoints {
	return &endpoints{
		cfg:    cfg,
		urls:   append([]string(nil), cfg.ClientURLs...),
		server: server,
	}
}

// ProvideEndpoints builds the shared endpoint provider from configuration and
// the Server that owns the embedded NATS lifecycle.
func ProvideEndpoints(cfg *setting.Cfg, server *Server) *endpoints {
	return newEndpoints(cfg.NATS, server)
}

// enabled reports whether NATS is turned on at all.
func (e *endpoints) enabled() bool { return e.cfg.Enabled }

// tls returns the client TLS configuration.
func (e *endpoints) tls() setting.NATSTLSSettings { return e.cfg.TLS }

// token returns the shared auth token, if any.
func (e *endpoints) token() string { return e.cfg.Auth.Token }

// URLs returns the client URLs known so far. In embedded mode the running
// server's local URL is prepended ahead of the configured peers. Safe for
// concurrent use.
func (e *endpoints) URLs() []string {
	if srv := e.embedded(); srv != nil {
		return append([]string{srv.ClientURL()}, e.urls...)
	}
	return append([]string(nil), e.urls...)
}

// dialOptions returns extra dial options. In embedded mode this carries the
// in-process server hop so the local connection bypasses TCP/TLS. Safe for
// concurrent use.
func (e *endpoints) dialOptions() []natsclient.Option {
	if srv := e.embedded(); srv != nil {
		return []natsclient.Option{natsclient.InProcessServer(srv)}
	}
	return nil
}

// embedded returns the running embedded server, or nil in external mode and
// before the embedded server has started.
func (e *endpoints) embedded() *natsserver.Server {
	if e.server == nil {
		return nil
	}
	return e.server.embeddedServer()
}
