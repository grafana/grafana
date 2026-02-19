package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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
	expectedAPIVersion := "grafana-testdata-datasource.datasource.grafana.app/v0alpha1"

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,       // Required to start the datasource api servers
			featuremgmt.FlagQueryServiceWithConnections,                // enables CRUD endpoints
			featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint, // enables resource endpoint
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"datasources.grafana-testdata-datasource.datasource.grafana.app": {
				DualWriterMode: grafanarest.Mode0,
			},
		},
	})

	client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
		Group:    "grafana-testdata-datasource.datasource.grafana.app",
		Version:  "v0alpha1",
		Resource: "datasources",
	}).Namespace("default")

	t.Run("create", func(t *testing.T) {
		out, err := client.Create(ctx, &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
				"kind":       "DataSource",
				"metadata": map[string]any{
					"name": "test",
				},
				"spec": map[string]any{
					"title": "test",
				},
				"secure": map[string]any{
					"aaa": map[string]any{
						"create": "AAA",
					},
					"bbb": map[string]any{
						"create": "BBB",
					},
				},
			},
		}, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "test", out.GetName())
		require.Equal(t, expectedAPIVersion, out.GetAPIVersion())

		obj, err := utils.MetaAccessor(out)
		require.NoError(t, err)

		secure, err := obj.GetSecureValues()
		require.NoError(t, err)

		keys := slices.Collect(maps.Keys(secure))
		require.ElementsMatch(t, []string{"aaa", "bbb"}, keys)
	})

	t.Run("update", func(t *testing.T) {
		out, err := client.Update(ctx, &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
				"metadata": map[string]any{
					"name": "test",
				},
				"spec": map[string]any{
					"title":     "test",
					"database":  "testdb",
					"url":       "http://fake.url",
					"access":    datasources.DS_ACCESS_PROXY,
					"user":      "example",
					"isDefault": true,
					"readOnly":  true,
					"jsonData": map[string]any{
						"hello": "world",
					},
				},
				"secure": map[string]any{
					"aaa": map[string]any{
						"remove": true,
					},
					"ccc": map[string]any{
						"create": "CCC", // add a third value
					},
				},
			},
		}, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, "test", out.GetName())
		require.Equal(t, expectedAPIVersion, out.GetAPIVersion())

		obj, err := utils.MetaAccessor(out)
		require.NoError(t, err)

		secure, err := obj.GetSecureValues()
		require.NoError(t, err)

		keys := slices.Collect(maps.Keys(secure))
		require.ElementsMatch(t, []string{"bbb", "ccc"}, keys)
	})

	t.Run("list", func(t *testing.T) {
		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, expectedAPIVersion, list.GetAPIVersion())
		require.Len(t, list.Items, 1, "expected a single datasource")
		require.Equal(t, "test", list.Items[0].GetName(), "with the test uid")

		spec, _, _ := unstructured.NestedMap(list.Items[0].Object, "spec")
		jj, _ := json.MarshalIndent(spec, "", "  ")
		// fmt.Printf("%s\n", string(jj))
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

	t.Run("execute", func(t *testing.T) {
		client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group:    "grafana-testdata-datasource.datasource.grafana.app",
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
		// 	"apiVersion": "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
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
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test/resource",
		}, nil)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Contains(t, string(raw.Body), "Hello world from test datasource!")
	})

	t.Run("delete", func(t *testing.T) {
		err := client.Delete(ctx, "test", metav1.DeleteOptions{})
		require.NoError(t, err)

		list, err := client.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})
}

func TestIntegrationTestDatasourceAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("get DatasourceAccessInfo", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,       // Required to start the datasource api servers
				featuremgmt.FlagQueryServiceWithConnections,                // enables CRUD endpoints
				featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint, // enables resource endpoint
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"datasources.grafana-testdata-datasource.datasource.grafana.app": {
					DualWriterMode: grafanarest.Mode0,
				},
			},
		})

		var datasourceAccessInfo datasourceV0alpha1.DatasourceAccessInfo
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test/access",
		}, &datasourceAccessInfo)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)

		expectedDatasourceAccessInfo := datasourceV0alpha1.DatasourceAccessInfo{
			TypeMeta: metav1.TypeMeta{
				Kind:       "DatasourceAccessInfo",
				APIVersion: "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
			},
			Permissions: accesscontrol.Metadata{
				"alert.instances.external:read":      true,
				"alert.instances.external:write":     true,
				"alert.notifications.external:read":  true,
				"alert.notifications.external:write": true,
				"alert.rules.external:read":          true,
				"alert.rules.external:write":         true,
				"datasources.id:read":                true,
				"datasources:delete":                 true,
				"datasources:query":                  true,
				"datasources:read":                   true,
				"datasources:write":                  true,
			},
		}
		require.Equal(t, datasourceAccessInfo, expectedDatasourceAccessInfo)
	})
}
