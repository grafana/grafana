package dashboards

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestTestDatasource(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // dev mode required for datasource connections
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("testdata.datasource.grafana.app")
		// fmt.Printf("%s", string(disco))

		require.JSONEq(t, `[
			{
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "connections",
				  "responseKind": {
					"group": "",
					"kind": "DataSourceConnection",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "shortNames": [
					"grafana-testdata-datasource-connection"
				  ],
				  "singularResource": "connection",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "HealthCheckResult",
						"version": ""
					  },
					  "subresource": "health",
					  "verbs": [
						"get"
					  ]
					},
					{
					  "responseKind": {
						"group": "",
						"kind": "Status",
						"version": ""
					  },
					  "subresource": "query",
					  "verbs": [
						"create",
						"get"
					  ]
					},
					{
					  "responseKind": {
						"group": "",
						"kind": "Status",
						"version": ""
					  },
					  "subresource": "resource",
					  "verbs": [
						"create",
						"delete",
						"get",
						"patch",
						"update"
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
