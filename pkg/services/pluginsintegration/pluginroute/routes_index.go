package pluginroute

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
)

// routeIndex decides from a request's path alone whether it can be for a
// manifest route, so the many requests for the API server's own resources go
// straight to it without a ServeMux lookup, which is far more expensive.
//
// It relies on manifestroutes.Parse: a version route never starts with a kind's
// plural, the settings resource, or namespaces, and a kind route is always
// below {plural}/{name}/ with a subresource other than status. So a path the
// index rejects is never a manifest route's, and one it accepts still has to
// match one in the mux.
type routeIndex struct {
	prefix   string // /apis/<group>/
	versions map[string]*[2]scopeIndex
}

// scopeIndex holds one scope's routes: cluster (0) or namespaced (1).
type scopeIndex struct {
	roots    map[string]bool // first path segment of a version route
	anyRoot  bool            // a version route starts with a parameter
	kinds    map[string]subresourceIndex
	hasKinds bool
}

// subresourceIndex holds the first segments below {plural}/{name}/ of a kind's
// routes.
type subresourceIndex struct {
	first map[string]bool
	any   bool // a kind route's subresource starts with a parameter
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
			scope.kinds = map[string]subresourceIndex{}
		}
		plural := strings.ToLower(route.Kind.Plural)
		subs := scope.kinds[plural]
		if subs.first == nil {
			subs.first = map[string]bool{}
		}
		first, _, _ := strings.Cut(route.Subresource, "/")
		if isParameterSegment(first) {
			subs.any = true
		} else {
			subs.first[first] = true
		}
		scope.kinds[plural] = subs
		scope.hasKinds = true
		return
	}

	root, _, _ := strings.Cut(route.Path, "/")
	if isParameterSegment(root) {
		scope.anyRoot = true
		return
	}
	if scope.roots == nil {
		scope.roots = map[string]bool{}
	}
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
	if scope.hasKinds {
		if subs, ok := scope.kinds[root]; ok {
			name, sub, ok := strings.Cut(below, "/")
			if !ok || name == "" {
				return false
			}
			first, _, _ := strings.Cut(sub, "/")
			return subs.any || subs.first[first]
		}
	}
	return scope.anyRoot || scope.roots[root]
}

func isParameterSegment(segment string) bool {
	return strings.HasPrefix(segment, "{")
}
