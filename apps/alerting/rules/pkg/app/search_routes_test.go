package app

import (
	"context"
	"fmt"
	"testing"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/stretchr/testify/require"

	v0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
)

func TestBuildSearchRoutes_usesCompatibilityPaths(t *testing.T) {
	handler := func(context.Context, sdkapp.CustomRouteResponseWriter, *sdkapp.CustomRouteRequest) error {
		return nil
	}
	routes := buildSearchRoutes(config.RuntimeConfig{
		SearchAlertRulesHandler:     handler,
		SearchRecordingRulesHandler: handler,
	})

	versionRoutes := routes["v0alpha1"]
	require.Len(t, versionRoutes, 2)
	for _, kind := range []resource.Kind{v0alpha1.AlertRuleKind(), v0alpha1.RecordingRuleKind()} {
		path := fmt.Sprintf("/%s/%s", kind.Plural(), SearchRulesPathSegment)
		_, ok := versionRoutes[simple.AppVersionRoute{
			Namespaced: true,
			Path:       path,
			Method:     simple.AppCustomRouteMethodPost,
		}]
		require.True(t, ok, "missing route %s", path)
	}
}
