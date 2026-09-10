package router

import (
	"context"
	"net/http"

	"github.com/grafana/dskit/services"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type Backend interface {
	// The backend fingerprint; a change means the route must be rebuilt.
	Key() string

	// The group this route serves (must not contain /)
	Group() metav1.APIGroup

	// How the prefix is handled. Handler support /apis/{group}* and /openapi/v3/{group}*
	Load(context.Context) (http.Handler, error)
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

// LifecycleRoutesLoader is a RoutesLoader that owns its own background
// lifecycle -- e.g. informers watching a remote apiserver for changes that
// feed Notify's wake signal. The router module runs it as a dskit service
// alongside the router Service (see pkg/server's initRouterModule) instead of
// assuming Load/Notify are all a loader ever needs driven for it.
type LifecycleRoutesLoader interface {
	RoutesLoader
	services.Service
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

	// HandleFunc serves routes for /apis*; everything else falls through to next.
	HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler)
}
