package router

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

type RouteConfig struct {
	// The resource version string -- if this changes, you know that something has changed
	RV string

	// The group this route serves
	Group string

	// How the prefix is handled.  This is always required
	Backend v1alpha2.RouteBackendSpec

	// For operator+plugin backends, we need the manifest to know how to handle requests
	Manifest *v1alpha2.AppManifestSpec // includes group, versions, resources, and custom route information
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

type Interface interface {
	// The loop that sets up the loader's notify and process ongoing events. Ready will return nil when it's done.
	Run(context.Context) error

	// Health returns nil when the router is fully initialized, connected to required databases, and ready to receive traffic.
	Ready(context.Context) error

	// returns nil unless the router is in a non-recoverable state, such as a deadlock, and requires a full restart.
	Alive(context.Context) error

	// The exposed HTTP handler attached to /apis*
	Handler() http.Handler

	// The exposed HTTP handler attached to /openapi/v3*
	OpenAPIV3Handler() http.Handler
}
