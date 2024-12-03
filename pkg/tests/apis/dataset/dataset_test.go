package dataset

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	dataset "github.com/grafana/grafana/pkg/apis/dataset/v0alpha1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPeakQ(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check object loading", func(t *testing.T) {
		raw, err := os.ReadFile("testdata/population_by_state.json")
		require.NoError(t, err)

		ds := &dataset.Dataset{}
		err = json.Unmarshal(raw, ds)
		require.NoError(t, err)

		require.Equal(t, 1, len(ds.Spec.Data))

		jj, err := json.MarshalIndent(ds, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s\n", string(jj))
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("dataset.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s", string(v1Disco))
		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "dataset.grafana.app/v0alpha1",
			"resources": [
				{
					"name": "datasets",
					"singularName": "dataset",
					"namespaced": true,
					"kind": "Dataset",
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
					"name": "datasets/frames",
					"singularName": "",
					"namespaced": true,
					"kind": "Dataset",
					"verbs": [
						"get"
					]
				}
			]
		}`, string(v1Disco))
	})
}
