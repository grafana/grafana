package router

import (
	"context"
	"net/http"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
)

type Backend interface {
	// The backend fingerprint; a change means the route must be rebuilt.
	Key() string

	// The group this route serves (must not contain /). It must change only
	// when Key does: reconcile keeps a served Backend while its key is
	// unchanged, and discovery is built from that Backend's group.
	Group() metav1.APIGroup

	// How the prefix is handled. Handler support /apis/{group}* and /openapi/v3/{group}*
	Load(context.Context) (http.Handler, error)

	// The backend source such as "aggregate:baas_apiserver" or "local-plugin"
	// this is used in the exposed metric labels
	Source() string
}

// DiscoveryProvider is an optional Backend interface for a backend that
// already knows its group's resources. The router builds that group's
// aggregated discovery from it instead of asking the backend on each request.
// The result must change only when Key does.
type DiscoveryProvider interface {
	Discovery() (apidiscoveryv2.APIGroupDiscovery, bool)
}

// ManifestProvider is an optional Backend interface for a backend defined by an
// app manifest. The router publishes the manifest under /discovery. The result
// must change only when Key does, and callers must not modify it.
type ManifestProvider interface {
	Manifest() (*app.ManifestData, bool)
}

// PluginStatusProvider is an optional Backend interface for a backend that
// serves a plugin's APIs, so the router's status page can show the plugin.
// The result must change only when Key does.
type PluginStatusProvider interface {
	PluginStatus() (PluginStatus, bool)
}

// PluginStatus is what the status page shows about a group's plugin. Any
// authenticated caller can read the page, so it must hold no credentials,
// addresses, URLs or error text.
type PluginStatus struct {
	ID      string `json:"id"`
	Version string `json:"version,omitempty"`
	// HasBackend reports whether the plugin runs a backend process for the
	// router to call; without one, only storage-backed kinds work.
	HasBackend bool `json:"hasBackend"`
}

// CallerScopedDiscovery is an optional Backend interface for a backend whose
// discovery depends on the caller. What the router advertises for it is only
// a default: when the unregistered-group handler answers root discovery for a
// request, that answer replaces the default. The router never caches its
// discovery and OpenAPI documents across callers; the backend decides what
// callers may share.
type CallerScopedDiscovery interface {
	CallerScopedDiscovery()
}

// NamespaceGroups reports whether a group is installed in a namespace. The
// router calls Allowed for every served group on each request from a caller
// with a namespace, so it must be safe for concurrent use and cheap: an
// implementation caches what it needs, since it knows when its source changes.
// When it cannot refresh a namespace, it answers from the last state it read,
// and returns an error only when it has none; the router then hides the group.
type NamespaceGroups interface {
	Allowed(ctx context.Context, namespace, group string) (bool, error)
}

type RoutesLoader interface {
	// Load all known routes
	// NOTE: this implies that the set of ALL routes is always reasonable to hold in memory
	// and that comparing changes can depend on the key to know if anything has changed for the prefix
	Load(context.Context) ([]Backend, error)

	// Something changed with routing... reload the configs. The channel is a pure
	// coalescing wake signal (no payload): consumers re-read full state via Load.
	Notify(context.Context) (<-chan struct{}, error)
}

// Router is the contract for the reconcile+serve engine. The standalone
// GrafanaRouter implements it
type Router interface {
	// Run runs the loop that sets up the loader's notify and process ongoing events.
	// Ready will return nil when it's done.
	// Load on RoutesLoader shouldn't be run until after Run is run.
	Run(context.Context) error

	// Ready returns nil when the router is fully initialized, connected to required databases, and ready to receive traffic.
	Ready(context.Context) error

	// Alive returns nil unless the router is in a non-recoverable state, such as a deadlock, and requires a full restart.
	Alive(context.Context) error

	// HandleAPIs serves routes for /apis*
	HandleAPIs() http.HandlerFunc

	// HandleOpenAPIv3 serves routes for /openapi/v3*
	HandleOpenAPIv3() http.HandlerFunc
}
