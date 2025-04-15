package dashboards

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSimpleQuery(t *testing.T) {
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

	t.Run("Call query with expression", func(t *testing.T) {
		client := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
			Group:   "query.grafana.app",
			Version: "v0alpha1",
		})

		body, err := json.Marshal(&data.QueryDataRequest{
			Queries: []data.DataQuery{
				data.NewDataQuery(map[string]any{
					"refId": "X",
					"datasource": data.DataSourceRef{
						Type: "grafana-testdata-datasource",
						UID:  ds.UID,
					},
					"scenarioId": "csv_content",
					"csvContent": "a\n1",
				}),
				data.NewDataQuery(map[string]any{
					"refId": "Y",
					"datasource": data.DataSourceRef{
						UID: "__expr__",
					},
					"type":       "math",
					"expression": "$X + 2",
				}),
			},
		})

		//t.Logf("%s", string(body))

		require.NoError(t, err)

		result := client.Post().
			Namespace("default").
			Suffix("query").
			SetHeader("Content-type", "application/json").
			Body(body).
			Do(context.Background())

		require.NoError(t, result.Error())

		contentType := "?"
		result.ContentType(&contentType)
		require.Equal(t, "application/json", contentType)

		body, err = result.Raw()
		require.NoError(t, err)
		t.Logf("OUT: %s", string(body))

		rsp := &backend.QueryDataResponse{}
		err = json.Unmarshal(body, rsp)
		require.NoError(t, err)
		require.Equal(t, 2, len(rsp.Responses))

		frameX := rsp.Responses["X"].Frames[0]
		frameY := rsp.Responses["Y"].Frames[0]

		vX, _ := frameX.Fields[0].ConcreteAt(0)
		vY, _ := frameY.Fields[0].ConcreteAt(0)

		require.Equal(t, int64(1), vX)
		require.Equal(t, float64(3), vY) // 1 + 2, but always float64
	})

	t.Run("Gets an error with invalid queries", func(t *testing.T) {
		client := helper.Org1.Admin.RESTClient(t, &schema.GroupVersion{
			Group:   "query.grafana.app",
			Version: "v0alpha1",
		})

		body, err := json.Marshal(&data.QueryDataRequest{
			Queries: []data.DataQuery{
				data.NewDataQuery(map[string]any{
					"refId": "Y",
					"datasource": data.DataSourceRef{
						UID: "__expr__",
					},
					"type":       "math",
					"expression": "$X + 2", // invalid X does not exit
				}),
			},
		})
		require.NoError(t, err)

		result := client.Post().
			Namespace("default").
			Suffix("query").
			SetHeader("Content-type", "application/json").
			Body(body).
			Do(context.Background())

		body, err = result.Raw()
		//t.Logf("OUT: %s", string(body))

		require.Error(t, err, "expecting a 400")
		require.JSONEq(t, `{
			"results": {
				"A": {
					"error": "[sse.dependencyError] did not execute expression [Y] due to a failure of the dependent expression or query [X]",
					"status": 400,
					"errorSource": ""
				}
			}
		}`, string(body))
		// require.JSONEq(t, `{
		// 	"status": "Failure",
		// 	"metadata": {},
		// 	"message": "did not execute expression [Y] due to a failure of the dependent expression or query [X]",
		// 	"reason": "BadRequest",
		// 	"details": { "group": "query.grafana.app" },
		// 	"code": 400,
		// 	"messageId": "sse.dependencyError",
		// 	"extra": { "depRefId": "X", "refId": "Y" }
		//   }`, string(body))

		statusCode := -1
		contentType := "?"
		result.ContentType(&contentType)
		result.StatusCode(&statusCode)
		require.Equal(t, "application/json", contentType)
		require.Equal(t, http.StatusBadRequest, statusCode)
	})
}
