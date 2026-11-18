package plugins

import "github.com/grafana/grafana/pkg/web"

// MatchRoute returns the first of routes, in the order they are declared, that
// serves method and proxyPath, as the plugin proxy matches them. path is what a
// final * in the route's path matched, and hasPath is whether it has one.
func MatchRoute(routes []*Route, method, proxyPath string) (route *Route, path string, hasPath bool) {
	for _, route := range routes {
		if route.Method != "" && route.Method != "*" && route.Method != method {
			continue
		}

		t := web.NewTree()
		t.Add(route.Path, nil)
		_, params, isMatch := t.Match(proxyPath)
		if !isMatch {
			continue
		}
		path, hasPath = params["*"]
		return route, path, hasPath
	}
	return nil, "", false
}
