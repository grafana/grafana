package playlist

import (
	"encoding/json"
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
		resources, err := disco.ServerResourcesForGroupVersion("folder.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		// fmt.Printf("%s", string(v1Disco))

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "folder.grafana.app/v0alpha1",
			"resources": [
			  {
				"name": "folders",
				"singularName": "folder",
				"namespaced": true,
				"kind": "Folder",
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
				"name": "folders/access",
				"singularName": "",
				"namespaced": true,
				"kind": "FolderAccessInfo",
				"verbs": [
				  "get"
				]
			  },
			  {
				"name": "folders/count",
				"singularName": "",
				"namespaced": true,
				"kind": "DescendantCounts",
				"verbs": [
				  "get"
				]
			  },
			  {
				"name": "folders/parents",
				"singularName": "",
				"namespaced": true,
				"kind": "FolderInfoList",
				"verbs": [
				  "get"
				]
			  }
			]
		  }`, string(v1Disco))
	})
}
