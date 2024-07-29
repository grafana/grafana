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
              "kind": "DashboardWithAccessInfo",
              "version": ""
            },
            "subresource": "dto",
            "verbs": [
              "get"
            ]
          },
          {
            "responseKind": {
              "group": "",
              "kind": "PartialObjectMetadataList",
              "version": ""
            },
            "subresource": "history",
            "verbs": [
              "get"
            ]
          }
        ],
        "verbs": [
          "create",
          "delete",
          "deletecollection",
          "get",
          "list",
          "patch",
          "update",
          "watch"
        ]
      }
    ],
    "version": "v0alpha1"
  }
]`, disco)
	})
}
