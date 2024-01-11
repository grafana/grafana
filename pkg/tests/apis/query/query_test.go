package dashboards

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/datasources"
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

	// Create a single datasource
	ds := helper.CreateDS(&datasources.AddDataSourceCommand{
		Name:  "test",
		Type:  datasources.DS_TESTDATA,
		UID:   "test",
		OrgID: int64(1),
	})
	require.Equal(t, "test", ds.UID)

	t.Run("Call query", func(t *testing.T) {
		client := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
			Group:   "query.grafana.app",
			Version: "v0alpha1",
		})

		result := client.Post().
			Namespace("default").
			Suffix("query").
			SetHeader("Content-type", "application/json").
			Body([]byte(`{
				"from": "now-1h",
				"to":   "now"
			}`)).
			Do(context.Background())

		require.NoError(t, result.Error())

		body, err := result.Raw()
		require.NoError(t, err)
		fmt.Printf("OUT: %s", string(body))
	})
}
