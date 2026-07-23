package router

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
)

type Backend interface {
	// The resource version string -- if this changes, you know that something has changed
	RV() string

	// The group this route serves (must not contain /)
	Group() string

	// How the prefix is handled. Handler support /apis/{group}* and /openapi/v3/{group}*
	Load(context.Context) (http.Handler, error)

	// Includes group, versions, resources, and custom route information
	Manifest() *app.ManifestData
}

type RoutesLoader interface {
	// Load all known routes
	// NOTE: this implies that the set of ALL routes is always reasonable to hold in memory
	// and that comparing changes can depend on the RV to know if anything has changed for the prefix
	Load(context.Context) ([]Backend, error)

	// Something changed with routing... reload the configs. The channel is a pure
	// coalescing wake signal (no payload): consumers re-read full state via Load.
	Notify(context.Context) (<-chan struct{}, error)
}

type Router interface {
	// Run runs the loop that sets up the loader's notify and process ongoing events.
	// Ready will return nil when it's done.
	// Load on RoutesLoader shouldn't be run until after Run is run.
	Run(context.Context) error

	// Health returns nil when the router is fully initialized, connected to required databases, and ready to receive traffic.
	Ready(context.Context) error

	// Alive returns nil unless the router is in a non-recoverable state, such as a deadlock, and requires a full restart.
	Alive(context.Context) error

	// HandleFunc serves routes for /apis*; everything else falls through to next.
	HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler)
}
