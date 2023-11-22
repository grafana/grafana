package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestDashboardsApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // do not start extra port 6443
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("dashboards.grafana.app")
		//fmt.Printf("%s", string(disco))

		require.JSONEq(t, `[
			{
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dashboards",
				  "responseKind": {
					"group": "",
					"kind": "DashboardResource",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "dashboard",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "DashboardAccessInfo",
						"version": ""
					  },
					  "subresource": "access",
					  "verbs": [
						"get"
					  ]
					},
					{
					  "responseKind": {
						"group": "",
						"kind": "DashboardVersionsInfo",
						"version": ""
					  },
					  "subresource": "versions",
					  "verbs": [
						"get"
					  ]
					}
				  ],
				  "verbs": [
					"get",
					"list"
				  ]
				}
			  ],
			  "version": "v0alpha1"
			}
		  ]`, disco)
	})
}
