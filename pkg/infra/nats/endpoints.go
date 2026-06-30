package nats

import (
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

// endpoints is the single, shared, client-facing view of the NATS bus: it owns
// everything a client needs to connect — the immutable configuration plus the
// runtime-resolved URLs and dial options — so clients (publisher, consumer)
// depend only on it and never carry their own copy of the config.
//
// It interprets the deployment mode itself by reading from the Server. In
// external mode (no embedded server) it simply exposes the configured client
// URLs. In embedded mode it reads the in-process server from the Server lazily
// at connect time, since that server is only known once it has started: the
// local URL is prepended ahead of any configured peers and the in-process dial
// option is added so the local hop bypasses TCP/TLS.
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
