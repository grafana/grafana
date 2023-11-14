package playlist

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestSnapshotsApp(t *testing.T) {
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
		disco := helper.GetGroupVersionInfoJSON("snapshots.grafana.app")

		//fmt.Printf("%s", disco)
		require.JSONEq(t, `[
			{
			  "version": "v0alpha1",
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dashboards",
				  "responseKind": {
					"group": "",
					"kind": "DashboardSnapshot",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "dashboard",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "Status",
						"version": ""
					  },
					  "subresource": "delete",
					  "verbs": [
						"delete"
					  ]
					}
				  ],
				  "verbs": [
					"create",
					"delete",
					"get",
					"list"
				  ]
				},
				{
				  "resource": "options",
				  "responseKind": {
					"group": "",
					"kind": "SnapshotSharingConfig",
					"version": ""
				  },
				  "scope": "Cluster",
				  "singularResource": "options",
				  "verbs": [
					"get",
					"list"
				  ]
				}
			  ]
			}
		  ]`, disco)
	})
}
