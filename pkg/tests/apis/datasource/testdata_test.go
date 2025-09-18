package dashboards

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationTestDatasource(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // dev mode required for datasource connections
		DisableAnonymous:  true,
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

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("testdata.datasource.grafana.app")
		fmt.Printf("%s", disco)

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
						"kind": "QueryDataResponse",
						"version": ""
					  },
					  "subresource": "query",
					  "verbs": [
						"create"
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
				},
				{
        			"resource": "queryconvert",
        			"responseKind": {
          				"group": "",
          				"kind": "QueryDataRequest",
          				"version": ""
        			},
        			"scope": "Namespaced",
        			"singularResource": "queryconvert",
        			"verbs": [
          				"create"
        			]
   				}
			  ],
			  "version": "v0alpha1"
			}
		  ]`, disco)
	})

	t.Run("Call subresources", func(t *testing.T) {
		client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "testdata.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "connections",
		}).Namespace("default")
		ctx := context.Background()

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1, "expected a single connection")
		require.Equal(t, "test", list.Items[0].GetName(), "with the test uid")

		rsp, err := client.Get(ctx, "test", metav1.GetOptions{}, "health")
		require.NoError(t, err)
		body, err := rsp.MarshalJSON()
		require.NoError(t, err)
		//fmt.Printf("GOT: %v\n", string(body))
		require.JSONEq(t, `{
			"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
			"code": 1,
			"kind": "HealthCheckResult",
			"message": "Data source is working",
			"status": "OK"
		  }
		`, string(body))

		// Test connecting to non-JSON marshaled data
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/testdata.datasource.grafana.app/v0alpha1/namespaces/default/connections/test/resource",
		}, nil)
		require.Equal(t, `Hello world from test datasource!`, string(raw.Body))
	})
}
