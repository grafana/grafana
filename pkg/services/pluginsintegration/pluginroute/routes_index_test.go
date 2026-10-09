package pluginroute

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
)

// The index must accept every path a route can match, and may reject a path
// only when no route can match it.
func TestRouteIndexCandidate(t *testing.T) {
	get := spec3.PathProps{Get: &spec3.Operation{}}
	version := app.ManifestVersion{
		Name: "v1",
		Kinds: []app.ManifestVersionKind{
			{Kind: "Thing", Plural: "Things", Scope: "Namespaced"},
			{Kind: "Node", Plural: "Nodes", Scope: "Cluster"},
		},
		OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
			"/report":                         get,
			"/files/{path:*}":                 get,
			"/namespaces/{namespace}/widgets": get,
			"/namespaces/{namespace}/things/{name}/reload": get,
			"/nodes/{name}/rebuild/{step}":                 get,
		}},
	}
	routes, problems := manifestroutes.Parse(version, routeOptions)
	require.Empty(t, problems)
	index := newRouteIndex("g.ext.grafana.app")
	for _, route := range routes {
		index.add("v1", route)
	}

	root := "/apis/g.ext.grafana.app/v1/"
	for path, want := range map[string]bool{
		root + "report":                                   true,
		root + "report/extra":                             true, // the mux decides
		root + "files/a/b/c.txt":                          true,
		root + "files":                                    true,
		root + "other":                                    false,
		root + "namespaces/default/widgets":               true,
		root + "namespaces/default/anything/export":       false,
		root + "namespaces/default/things":                false,
		root + "namespaces/default/things/thing-1":        false,
		root + "namespaces/default/things/thing-1/status": false,
		root + "namespaces/default/things/thing-1/reload": true,
		root + "nodes/node-1/rebuild/now":                 true,
		root + "nodes/node-1/status":                      false,
		root + "nodes/node-1/anything":                    false,
		root + "nodes":                                    false,
		root + "nodes/node-1":                             false,
		root + "namespaces":                               false,
		root + "namespaces/default":                       false,
		root + "namespaces//widgets":                      false,
		"/apis/g.ext.grafana.app/v2/report":               false,
		"/apis/g.ext.grafana.app/v1":                      false,
		"/apis/other.ext.grafana.app/v1/report":           false,
		"/openapi/v3/apis/g.ext.grafana.app/v1":           false,
	} {
		require.Equal(t, want, index.candidate(path), path)
	}
}
