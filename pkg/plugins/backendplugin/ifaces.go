package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/log"
)

// Plugin is the backend plugin interface.
type Plugin interface {
	PluginID() string
	Logger() log.Logger
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsManaged() bool
	Exited() bool
	Decommission() error
	IsDecommissioned() bool
	Target() Target
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.QueryDataHandler
	backend.QueryChunkedDataHandler
	backend.CallResourceHandler
	backend.AdmissionHandler
	backend.ConversionHandler
	backend.StreamHandler
}

// StoredObjectEventsStream is one open bidirectional stored-object events
// stream between Grafana and a plugin backend. Grafana pushes change events
// with Send and receives the plugin's subscription messages — each the full
// replacement set of kind names it wants events for — with RecvSubscription.
type StoredObjectEventsStream interface {
	Send(event *backend.StoredObjectEvent) error
	RecvSubscription() ([]string, error)
	// Close closes Grafana's send side of the stream. Callers that need a
	// hard teardown (e.g. the plugin stopped responding) should cancel the
	// context the stream was opened with instead.
	Close() error
}

// StoredObjectEventsStreamer is implemented by backend plugin handles that
// can open a stored-object events stream. It is intentionally NOT part of
// the Plugin interface (or plugins.Client): widening those would ripple
// through every client middleware for a capability only the app-plugin
// apiserver uses, so callers type-assert the handle instead.
//
// PoC caveat: streams opened this way bypass the plugins.Client middleware
// chain (instrumentation, tracing, etc.); a production version must revisit
// where this capability lives.
type StoredObjectEventsStreamer interface {
	StreamStoredObjectEvents(ctx context.Context) (StoredObjectEventsStream, error)
}

type Target string

const (
	TargetNone     Target = "none"
	TargetUnknown  Target = "unknown"
	TargetInMemory Target = "in_memory"
	TargetLocal    Target = "local"
)
