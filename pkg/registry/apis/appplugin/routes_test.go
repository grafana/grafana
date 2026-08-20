package appplugin

import (
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// Registers the manifest custom routes the same way server startup does.
// A duplicate method+path registration fails the whole apiserver at startup:
// the OpenAPI builders reject it with "duplicate webservice route has been
// found for path".
func TestGetAPIRoutesRegistration(t *testing.T) {
	b := &AppPluginAPIBuilder{
		manifest:   &exampleManifestData,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	container := restful.NewContainer()
	err := builder.AugmentWebServicesWithCustomRoutes(
		container, []builder.APIGroupBuilder{b}, prometheus.NewRegistry(), nil)
	require.NoError(t, err)

	registered := map[string]int{}
	for _, ws := range container.RegisteredWebServices() {
		for _, r := range ws.Routes() {
			registered[r.Method+" "+r.Path]++
		}
	}
	for route, count := range registered {
		require.Equal(t, 1, count, "duplicate route registration would fail the OpenAPI build at startup: %s", route)
	}

	// Cluster routes mount at the group-version root, namespaced ones under namespaces
	require.Contains(t, registered, "GET /apis/example-app/v1alpha1/foobar")
	require.Contains(t, registered, "GET /apis/example-app/v1alpha1/namespaces/{namespace}/foobar")
	require.Contains(t, registered, "GET /apis/example-app/v2alpha1/namespaces/{namespace}/example")
}
