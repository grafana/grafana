// Package rawroutes describes namespaced HTTP routes that an API group serves
// outside the k8s handler chain.
//
// A raw route is for traffic that does not fit an API request, such as a
// websocket that hijacks the connection and stays open for hours. The host
// mounts raw routes in front of the k8s handler chain, so they skip its request
// timeout, max-in-flight and priority-and-fairness filters, authorization and
// audit, and the Grafana router. The route handler is responsible for its own
// authorization.
package rawroutes

import "net/http"

// Route is served at /apis/{Group}/{Version}/namespaces/{namespace}/{Path}.
type Route struct {
	Group   string
	Version string
	// Method is the HTTP method, for example http.MethodGet.
	Method string
	// Path is relative to namespaces/{namespace}/, for example "ws".
	Path string
	// Handler receives the request with the requester on its context and the
	// namespace as the "namespace" path value (r.PathValue("namespace")).
	Handler http.Handler
}

// Provider is implemented by app installers or API group builders that serve
// raw routes.
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
