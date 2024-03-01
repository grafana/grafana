package dashboards

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationRequiresDevMode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // should fail
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.Error(t, err)
}

func TestIntegrationDashboardsApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})
	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.NoError(t, err)

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("dashboard.grafana.app")
		// fmt.Printf("%s", string(disco))

		require.JSONEq(t, `[
			{
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dashboards",
				  "responseKind": {
					"group": "",
					"kind": "Dashboard",
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
					"create",
					"delete",
					"get",
					"list",
					"patch",
					"update"
				  ]
				},
				{
				  "resource": "summary",
				  "responseKind": {
					"group": "",
					"kind": "DashboardSummary",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "summary",
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
