// Package routemux serves the custom routes an app manifest version declares in
// its OpenAPI paths, as resolved by app-sdk's routes package. Both the
// manifest API server and the app settings API server mount their routes
// through it, so a route is matched the same way whichever serves it.
package routemux

import (
	"net/http"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// Version is the routes one served version mounts.
type Version struct {
	Name   string
	Routes []manifestroutes.Route
}

// HandlerFunc returns the handler serving every operation of one route.
type HandlerFunc func(gv schema.GroupVersion, route manifestroutes.Route) http.Handler

// Wrap serves the versions' routes and hands every other request to next. It
// wraps the API server's handler, inside the filter chain, so a request
// reaching a route has already been authenticated and authorized.
func Wrap(group string, versions []Version, handlerFor HandlerFunc, next http.Handler, reg prometheus.Registerer) http.Handler {
	metrics := builder.NewCustomRouteMetrics(reg)
	mux := http.NewServeMux()
	index := newRouteIndex(group)
	mounted := 0
	for _, version := range versions {
		gv := schema.GroupVersion{Group: group, Version: version.Name}
		root := "/apis/" + gv.String() + "/"
		for _, route := range version.Routes {
			handler := metrics.InstrumentHandler(gv.Group, gv.Version, route.Path, handlerFor(gv, route).ServeHTTP)
			// manifestroutes.Parse has already registered every pattern on a
			// scratch mux, so registering them again cannot fail.
			for method := range manifestroutes.Operations(&route.Operations) {
				mux.Handle(method+" "+root+route.Pattern, handler)
				mounted++
			}
			index.add(version.Name, route)
		}
	}
	if mounted == 0 {
		return next
	}

	// Reached for a candidate that no route matches. Only candidates go through
	// the mux, so its cleaning and redirecting of paths never touches the API
	// server's requests.
	mux.Handle(fallbackPattern, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The path is a route's, since paths the apiserver serves are never
		// mounted, so an undeclared method is refused here rather than passed on
		// to answer 404.
		if allowed := allowedMethods(mux, r); len(allowed) > 0 {
			methodNotAllowed(w, r, allowed)
			return
		}
		next.ServeHTTP(w, r)
	}))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !index.candidate(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// fallbackPattern is registered on the route mux for a candidate path that no
// route matches.
const fallbackPattern = "/"

// servedMethods are the methods a route can be mounted for. HEAD is matched by
// a GET pattern too.
var servedMethods = []string{
	http.MethodDelete, http.MethodGet, http.MethodHead,
	http.MethodOptions, http.MethodPatch, http.MethodPost, http.MethodPut,
}

// allowedMethods returns the methods mux serves for r's path, the same lookup
// ServeMux makes for its own 405s, leaving out the fallback. Registering a
// method-less pattern per path instead would conflict with another route's
// wildcard.
func allowedMethods(mux *http.ServeMux, r *http.Request) []string {
	var allowed []string
	// A shallow copy is enough to look up a route, and this runs for every
	// request the apiserver serves, so the headers are not cloned.
	probe := *r
	for _, method := range servedMethods {
		probe.Method = method
		if _, pattern := mux.Handler(&probe); pattern != "" && pattern != fallbackPattern {
			allowed = append(allowed, method)
		}
	}
	return allowed
}

// methodNotAllowed answers a method the route does not declare, listing the
// ones it does.
func methodNotAllowed(w http.ResponseWriter, r *http.Request, allowed []string) {
	w.Header().Set("Allow", strings.Join(allowed, ", "))
	// Not apierrors.NewMethodNotSupported, which names a resource kind that a
	// custom route does not have.
	_ = errhttp.Write(r.Context(), &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusMethodNotAllowed,
		Reason:  metav1.StatusReasonMethodNotAllowed,
		Message: r.Method + " is not supported",
	}}, w)
}
