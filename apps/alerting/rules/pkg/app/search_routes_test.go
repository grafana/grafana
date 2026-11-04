package app

import (
	"context"
	"testing"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/stretchr/testify/require"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
)

func TestBuildSearchRoutes_perKindRoutes(t *testing.T) {
	handler := func(context.Context, sdkapp.CustomRouteResponseWriter, *sdkapp.CustomRouteRequest) error {
		return nil
	}
	routes := buildSearchRoutes(config.RuntimeConfig{
		SearchAlertRulesHandler:     handler,
		SearchRecordingRulesHandler: handler,
	})

	versionRoutes := routes["v0alpha1"]
	require.Len(t, versionRoutes, 2)
	for _, resource := range []string{SearchAlertRulesResource, SearchRecordingRulesResource} {
		path := "/" + resource
		_, ok := versionRoutes[simple.AppVersionRoute{
			Namespaced: true,
			Path:       path,
			Method:     simple.AppCustomRouteMethodPost,
		}]
		require.True(t, ok, "missing route %s", path)
	}
}

// ValidateManifest does not check custom routes, and the authorizer matches on
// the route names, so a path rename that misses them would leave a search
// without its list check.
func TestSearchRouteNamesMatchManifest(t *testing.T) {
	paths := map[string]struct{}{}
	for _, version := range rulesmanifest.LocalManifest().ManifestData.Versions {
		for path := range version.OpenAPI.Paths {
			paths[path] = struct{}{}
		}
	}
	for _, resource := range []string{SearchAlertRulesResource, SearchRecordingRulesResource} {
		require.Contains(t, paths, "/namespaces/{namespace}/"+resource)
	}
}
