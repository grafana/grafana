package router

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

type RouteConfig struct {
	// The resource version string -- if this changes, you know that something has changed
	RV string

	// The group this route serves
	Group string

	// How the prefix is handled.  This is always required
	Backend v1alpha2.RouteBackendSpec

	// Includes group, versions, resources, and custom route information
	Manifest app.ManifestData
}

type RoutesLoader interface {
	// Load all known routes
	// NOTE: this implies that the set of ALL routes is always reasonable to hold in memory
	// and that comparing changes can depend on the RV to know if anything has changed for the prefix
	Load(context.Context) ([]*RouteConfig, error)

	// Something changed with routing... reload the configs. The channel is a pure
	// coalescing wake signal (no payload): consumers re-read full state via Load.
	Notify(context.Context) (<-chan struct{}, error)
}

// Backend corresponds to one served Group
type Backend interface {
	// Handler
	Handler() http.Handler

	// OpenAPIV3Handler
	OpenAPIV3Handler() http.Handler

	// Ready is the proof that passed configuration is correct and we are able to serve.
	Ready(context.Context) error
}

type Router interface {
	// Run runs the loop that sets up the loader's notify and process ongoing events.
	// Ready will return nil when it's done.
	Run(context.Context) error

	// Health returns nil when the router is fully initialized, connected to required databases, and ready to receive traffic.
	Ready(context.Context) error

	// Alive returns nil unless the router is in a non-recoverable state, such as a deadlock, and requires a full restart.
	Alive(context.Context) error

	// Handler will be passed routes for /apis* and /openapi/v3*, everything else will fallthrough to next
	Handler(next http.Handler) http.Handler
}
