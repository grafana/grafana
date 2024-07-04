package playlist

import (
	"encoding/json"
<<<<<<< HEAD
	"fmt"
=======
>>>>>>> origin/resource-store-bridge
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

func TestIntegrationFoldersApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("peakq.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
<<<<<<< HEAD
		fmt.Printf("%s", string(v1Disco))
=======
		//fmt.Printf("%s", string(v1Disco))
>>>>>>> origin/resource-store-bridge
		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "peakq.grafana.app/v0alpha1",
			"resources": [
				{
				"name": "querytemplates",
				"singularName": "querytemplate",
				"namespaced": true,
				"kind": "QueryTemplate",
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
				},
				{
				"name": "querytemplates/render",
				"singularName": "",
				"namespaced": true,
				"kind": "RenderedQuery",
				"verbs": [
					"get"
				]
				}
			]
		}`, string(v1Disco))
	})
}
