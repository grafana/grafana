// Package rawroutes describes HTTP routes, namespaced or cluster-scoped, that an
// API group serves outside the k8s handler chain.
//
// A raw route is for traffic that does not fit an API request, such as a
// websocket that hijacks the connection and stays open for hours. The host
// mounts raw routes in front of the k8s handler chain, so they skip its request
// timeout, max-in-flight and priority-and-fairness filters, authorization and
// audit, and the Grafana router. The route handler is responsible for its own
// authorization.
package rawroutes

import (
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Route is served at /apis/{group}/{version}/namespaces/{namespace}/{Path} when
// Namespaced, and at /apis/{group}/{version}/{Path} otherwise.
type Route struct {
	// API is the group and version that serve the route.
	API schema.GroupVersion
	// Method is the HTTP method, for example http.MethodGet.
	Method string
	// Namespaced puts the route under namespaces/{namespace}/.
	Namespaced bool
	// Path is relative to the version, or to namespaces/{namespace}/ when
	// Namespaced, for example "ws".
	Path string
	// Handler receives the request with the requester on its context. For a
	// namespaced route, the namespace is the "namespace" path value
	// (r.PathValue("namespace")).
	Handler http.Handler
}

// Provider is implemented by app installers or API group builders that serve
// raw routes. Hosts collect raw routes once, before the HTTP server starts, so
// an installer registered after that does not get its raw routes mounted.
type Provider interface {
	RawRoutes() []Route
}

// Collect returns the raw routes of every item that implements Provider.
func Collect[T any](items []T) []Route {
	var routes []Route
	for _, item := range items {
		if p, ok := any(item).(Provider); ok {
			routes = append(routes, p.RawRoutes()...)
		}
	}
	return routes
}
