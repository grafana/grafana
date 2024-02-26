package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestSimpleQuery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // dev mode required for datasource connections
		EnableFeatureToggles: []string{
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

		q := resource.GenericDataQuery{
			CommonQueryProperties: resource.CommonQueryProperties{
				Datasource: &resource.DataSourceRef{
					Type: "grafana-testdata-datasource",
					UID:  ds.UID,
				},
			},
		}
		q.Set("csvContent", `a,b,c\n1,hello,true`)
		q.Set("scenarioId", `csv_content`)
		body, err := json.Marshal(&resource.GenericQueryRequest{
			Queries: []resource.GenericDataQuery{q},
		})
		require.NoError(t, err)

		fmt.Printf("%s\n", string(body))

		result := client.Post().
			Namespace("default").
			Suffix("query").
			SetHeader("Content-type", "application/json").
			Body(body).
			Do(context.Background())

		require.NoError(t, result.Error())

		body, err = result.Raw()
		require.NoError(t, err)
		fmt.Printf("OUT: %s", string(body))

		rsp := &backend.QueryDataResponse{}
		err = json.Unmarshal(body, rsp)
		require.NoError(t, err)
		require.Equal(t, 1, len(rsp.Responses))

		frame := rsp.Responses["A"].Frames[0]
		disp, err := frame.StringTable(100, 10)
		require.NoError(t, err)
		fmt.Printf("%s\n", disp)

		type expect struct {
			idx  int
			name string
			val  any
		}
		for _, check := range []expect{
			{0, "a", int64(1)},
			{1, "b", "hello"},
			{2, "c", true},
		} {
			field := frame.Fields[check.idx]
			require.Equal(t, check.name, field.Name)

			v, _ := field.ConcreteAt(0)
			require.Equal(t, check.val, v)
		}
	})
}
