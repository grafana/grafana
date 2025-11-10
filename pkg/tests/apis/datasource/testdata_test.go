package dashboards

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/components/simplejson"
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

		// These settings are not actually used, but testing that they get saved
		Database: "testdb",
		URL:      "http://fake.url",
		Access:   datasources.DS_ACCESS_PROXY,
		User:     "example",
		ReadOnly: true,
		JsonData: simplejson.NewFromAny(map[string]any{
			"hello": "world",
		}),
		SecureJsonData: map[string]string{
			"aaa": "AAA",
			"bbb": "BBB",
		},
	})
	require.Equal(t, "test", ds.UID)

	t.Run("Admin configs", func(t *testing.T) {
		client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "testdata.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		}).Namespace("default")
		ctx := context.Background()

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1, "expected a single connection")
		require.Equal(t, "test", list.Items[0].GetName(), "with the test uid")

		spec, _, _ := unstructured.NestedMap(list.Items[0].Object, "spec")
		jj, _ := json.MarshalIndent(spec, "", "  ")
		fmt.Printf("%s\n", string(jj))
		require.JSONEq(t, `{
			"access": "proxy",
			"database": "testdb",
			"isDefault": true,
			"jsonData": {
				"hello": "world"
			},
			"readOnly": true,
			"title": "test",
			"url": "http://fake.url",
			"user": "example"
		}`, string(jj))
	})

	t.Run("Call subresources", func(t *testing.T) {
		client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "testdata.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		}).Namespace("default")
		ctx := context.Background()

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1, "expected a single connection")
		require.Equal(t, "test", list.Items[0].GetName(), "with the test uid")

		_, err = client.Get(ctx, "test", metav1.GetOptions{}, "health")
		// endpoint is disabled currently because it has not been
		// sufficiently tested.
		// for more info see pkg/registry/apis/datasource/sub_health.go
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, int32(501), statusErr.ErrStatus.Code)
		// require.NoError(t, err)
		// body, err := rsp.MarshalJSON()
		// require.NoError(t, err)
		// //fmt.Printf("GOT: %v\n", string(body))
		// require.JSONEq(t, `{
		// 	"apiVersion": "testdata.datasource.grafana.app/v0alpha1",
		// 	"code": 1,
		// 	"kind": "HealthCheckResult",
		// 	"message": "Data source is working",
		// 	"status": "OK"
		//   }
		// `, string(body))

		// Test connecting to non-JSON marshaled data
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/testdata.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test/resource",
		}, nil)
		// endpoint is disabled currently because it has not been
		// sufficiently tested.
		// for more info see pkg/registry/apis/datasource/sub_resource.go
		require.Equal(t, int32(501), raw.Status.Code)
		// require.Equal(t, `Hello world from test datasource!`, string(raw.Body))
	})
}
