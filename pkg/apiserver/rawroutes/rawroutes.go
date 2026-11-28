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
	"fmt"
	"net/http"
	"strings"

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

// Pattern returns the http.ServeMux pattern for the route, for example
// "GET /apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws".
func (r Route) Pattern() string {
	p := r.Method + " /apis/" + r.API.Group + "/" + r.API.Version + "/"
	if r.Namespaced {
		p += "namespaces/{namespace}/"
	}
	return p + r.Path
}

// NewHandler serves routes and passes every other request to next. It is for
// hosts that mount raw routes on a plain http.Handler chain, such as a
// standalone API server, where it goes after authentication and before the
// k8s handler chain. Requests reach a route's handler with the namespace as the
// "namespace" path value.
func NewHandler(next http.Handler, routes []Route) (http.Handler, error) {
	if len(routes) == 0 {
		return next, nil
	}
	mux := http.NewServeMux()
	for _, rt := range routes {
		if err := rt.Validate(); err != nil {
			return nil, err
		}
		if err := register(mux, rt.Pattern(), rt.Handler); err != nil {
			return nil, err
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// mux.Handler only looks the route up; ServeHTTP also sets the path values.
		if _, pattern := mux.Handler(r); pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	}), nil
}

// Validate reports a route that cannot be mounted: it needs a group and
// version, a relative path, a handler, and the GET or POST method.
func (r Route) Validate() error {
	switch {
	case r.API.Group == "" || r.API.Version == "":
		return fmt.Errorf("raw route %s: group and version are required", r.Pattern())
	case r.Path == "" || strings.HasPrefix(r.Path, "/"):
		return fmt.Errorf("raw route %s: path must be relative and not empty", r.Pattern())
	case r.Handler == nil:
		return fmt.Errorf("raw route %s: handler is required", r.Pattern())
	case r.Method != http.MethodGet && r.Method != http.MethodPost:
		return fmt.Errorf("raw route %s: unsupported method", r.Pattern())
	}
	return nil
}

// register reports a duplicate pattern as an error; ServeMux panics on one.
func register(mux *http.ServeMux, pattern string, h http.Handler) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("raw route %s: %v", pattern, p)
		}
	}()
	mux.Handle(pattern, h)
	return nil
}
