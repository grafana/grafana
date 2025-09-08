package dashboardsnapshots

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardSnapshots(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental apis
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // required to register dashboardsnapshot.grafana.app
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("dashboardsnapshot.grafana.app")

		// fmt.Printf("%s", disco)
		require.JSONEq(t, `[
			{
			  "freshness": "Current",
			  "resources": [
				{
				  "resource": "dashboardsnapshots",
				  "responseKind": {
					"group": "",
					"kind": "DashboardSnapshot",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "dashboardsnapshot",
				  "subresources": [
					{
					  "responseKind": {
						"group": "",
						"kind": "FullDashboardSnapshot",
						"version": ""
					  },
					  "subresource": "body",
					  "verbs": [
						"get"
					  ]
					}
				  ],
				  "verbs": [
					"delete",
					"get",
					"list"
				  ]
				},
				{
				  "resource": "options",
				  "responseKind": {
					"group": "",
					"kind": "SharingOptions",
					"version": ""
				  },
				  "scope": "Namespaced",
				  "singularResource": "options",
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
