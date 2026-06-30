package nats

import (
	"sync"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/setting"
)

// endpoints decouples NATS clients (publisher, consumer) from how the broker is
// reached. In external mode it simply exposes the configured client URLs. In
// embedded mode the Server populates it at runtime with the in-process server
// URL and dial option, since those are only known once the embedded server has
// started. Clients read from it lazily at connect time, so a single endpoints
// instance is shared by every client and mutated once by the Server.
type endpoints struct {
	mu    sync.RWMutex
	urls  []string
	extra []natsclient.Option
}

func newEndpoints(cfg setting.NATSSettings) *endpoints {
	return &endpoints{urls: append([]string(nil), cfg.ClientURLs...)}
}

// ProvideEndpoints builds the shared endpoint provider from configuration.
func ProvideEndpoints(cfg *setting.Cfg) *endpoints {
	return newEndpoints(cfg.NATS)
}

// URLs returns the client URLs known so far. Safe for concurrent use.
func (e *endpoints) URLs() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return append([]string(nil), e.urls...)
}

// dialOptions returns extra dial options (e.g. the in-process server hop). Safe
// for concurrent use.
func (e *endpoints) dialOptions() []natsclient.Option {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return append([]natsclient.Option(nil), e.extra...)
}

// setEmbedded records the embedded server's local client URL, prepended ahead of
// any configured peers, plus the in-process dial option so the local hop bypasses
// TCP/TLS. Called once by the Server after it becomes ready.
func (e *endpoints) setEmbedded(server *natsserver.Server, configured []string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.urls = append([]string{server.ClientURL()}, configured...)
	e.extra = []natsclient.Option{natsclient.InProcessServer(server)}
}
