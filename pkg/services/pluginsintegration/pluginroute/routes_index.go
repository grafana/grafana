package pluginroute

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
)

// routeIndex decides from a request's path alone whether it can be for a
// manifest route, so the many requests for the API server's own resources go
// straight to it without a ServeMux lookup, which is far more expensive.
//
// It relies on manifestroutes.Parse: a version route starts with a literal
// segment that is not a kind's plural, the settings resource, or namespaces,
// and a kind route is below {plural}/{name}/ with a subresource that starts
// with a literal segment other than status. So the first segment of a path
// decides whether a route can match it, a path the index rejects is never a
// manifest route's, and one it accepts still has to match one in the mux.
type routeIndex struct {
	prefix   string // /apis/<group>/
	versions map[string]*[2]scopeIndex
}

// scopeIndex holds one scope's routes: cluster (0) or namespaced (1).
type scopeIndex struct {
	roots map[string]bool // first path segment of a version route
	// kinds holds, by plural, the first segments below {plural}/{name}/ of the
	// kind's routes.
	kinds map[string]map[string]bool
}

func newRouteIndex(group string) *routeIndex {
	return &routeIndex{prefix: "/apis/" + group + "/", versions: map[string]*[2]scopeIndex{}}
}

func (x *routeIndex) add(version string, route manifestroutes.Route) {
	scopes := x.versions[version]
	if scopes == nil {
		scopes = &[2]scopeIndex{}
		x.versions[version] = scopes
	}
	scope := &scopes[0]
	if route.Namespaced {
		scope = &scopes[1]
	}

	if route.Kind != nil {
		if scope.kinds == nil {
			scope.kinds = map[string]map[string]bool{}
		}
		plural := strings.ToLower(route.Kind.Plural)
		if scope.kinds[plural] == nil {
			scope.kinds[plural] = map[string]bool{}
		}
		first, _, _ := strings.Cut(route.Subresource, "/")
		scope.kinds[plural][first] = true
		return
	}

	if scope.roots == nil {
		scope.roots = map[string]bool{}
	}
	root, _, _ := strings.Cut(route.Path, "/")
	scope.roots[root] = true
}

// candidate reports whether path can be for a manifest route.
func (x *routeIndex) candidate(path string) bool {
	rest, ok := strings.CutPrefix(path, x.prefix)
	if !ok {
		return false
	}
	version, rest, ok := strings.Cut(rest, "/")
	if !ok {
		return false
	}
	scopes := x.versions[version]
	if scopes == nil {
		return false
	}
	scope := &scopes[0]
	if after, ok := strings.CutPrefix(rest, "namespaces/"); ok {
		namespace, after, ok := strings.Cut(after, "/")
		if !ok || namespace == "" {
			return false
		}
		scope, rest = &scopes[1], after
	}

	root, below, _ := strings.Cut(rest, "/")
	if subresources, ok := scope.kinds[root]; ok {
		name, sub, ok := strings.Cut(below, "/")
		if !ok || name == "" {
			return false
		}
		first, _, _ := strings.Cut(sub, "/")
		return subresources[first]
	}
	return scope.roots[root]
}
