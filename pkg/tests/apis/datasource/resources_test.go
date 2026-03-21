package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// testdataResponse represents the JSON response from /test/json endpoint for grafana-test-dataosurce
type testdataResponse struct {
	Message string `json:"message"`
	Request struct {
		Method  string              `json:"method"`
		URL     url.URL             `json:"url"`
		Headers map[string][]string `json:"headers"`
		Body    map[string]any      `json:"body"`
	} `json:"request"`
}

func setup(t *testing.T) *apis.K8sTestHelper {
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,       // Required to start the datasource api servers
			featuremgmt.FlagQueryServiceWithConnections,                // enables CRUD endpoints
			featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint, // enables resource endpoint
		},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	client := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
		Group:    "grafana-testdata-datasource.datasource.grafana.app",
		Version:  "v0alpha1",
		Resource: "datasources",
	}).Namespace("default")

	_, err := client.Create(ctx, &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "grafana-testdata-datasource.datasource.grafana.app/v0alpha1",
			"kind":       "DataSource",
			"metadata": map[string]any{
				"name": "test-resource",
			},
			"spec": map[string]any{
				"title": "Test Resource Datasource",
			},
		},
	}, metav1.CreateOptions{})

	if err != nil {
		t.Fatalf("failed to create datasource: %v", err)
	}

	return helper
}

func TestIntegrationDatasourceResources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setup(t)

	t.Run("GET resource endpoint returns testdata response", func(t *testing.T) {
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource",
		}, nil)

		require.Equal(t, http.StatusOK, raw.Response.StatusCode, "expected OK status, got body: %s", string(raw.Body))
		require.Contains(t, string(raw.Body), "Hello world", "expected testdata greeting response")
	})

	t.Run("GET /test/json returns JSON with request echo", func(t *testing.T) {
		helper := setup(t)

		raw := apis.DoRequest[testdataResponse](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/json",
		}, &testdataResponse{})

		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.NotNil(t, raw.Result)
		require.Equal(t, "Hello world from test datasource!", raw.Result.Message)
		require.Equal(t, "GET", raw.Result.Request.Method)
	})

	t.Run("POST with body echoes request body", func(t *testing.T) {
		raw := apis.DoRequest[testdataResponse](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/json",
			Body:   []byte(`{"foo": "bar", "count": 42}`),
		}, &testdataResponse{})

		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.NotNil(t, raw.Result)
		require.Equal(t, "POST", raw.Result.Request.Method)
		require.NotNil(t, raw.Result.Request.Body)
		require.Equal(t, "bar", raw.Result.Request.Body["foo"])
		require.Equal(t, float64(42), raw.Result.Request.Body["count"])
	})
}

func TestIntegrationDatasourceResourceHeaders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setup(t)
	t.Run("auth headers are stripped before request reaches plugin", func(t *testing.T) {
		raw := apis.DoRequest[testdataResponse](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/json",
			Headers: map[string]string{
				"X-Custom-Header": "custom-value",
			},
			ContentType: "application/json",
			Accept:      "application/json",
			Body:        []byte(`{"foo": "bar", "count": 42}`),
		}, &testdataResponse{})

		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.NotNil(t, raw.Result)

		// ClearAuthHeaders middleware should strip auth headers before request is sent to plugin
		authHeaders := raw.Result.Request.Headers["Authorization"]
		require.Empty(t, authHeaders, "Authorization header should be stripped before request reaches plugin")
		deviceIDHeaders := raw.Result.Request.Headers["X-Grafana-Device-Id"]
		require.Empty(t, deviceIDHeaders, "X-Grafana-Device-Id header should be stripped before request reaches plugin")
		// Non-auth headers must still be forwarded
		customHeaders := raw.Result.Request.Headers["X-Custom-Header"]
		require.NotEmpty(t, customHeaders)
		require.Equal(t, "custom-value", customHeaders[0])
	})

	t.Run("query parameters are forwarded to plugin", func(t *testing.T) {
		raw := apis.DoRequest[testdataResponse](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/json?param1=value1&param2=value2",
		}, &testdataResponse{})

		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.NotNil(t, raw.Result)

		// parse raw.Body to testdataResponse
		testdataResponse := &testdataResponse{}
		err := json.Unmarshal(raw.Body, testdataResponse)
		require.NoError(t, err, "failed to unmarshal response body: %s", string(raw.Body))

		require.Contains(t, testdataResponse.Request.URL.RawQuery, "param1=value1", "URL in plugin should contain query parameters")
		require.Contains(t, testdataResponse.Request.URL.RawQuery, "param2=value2", "URL in plugin should contain query parameters")
	})
}

func TestIntegrationDatasourceStreamingResource(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setup(t)

	t.Run("GET streaming resource returns expected response", func(t *testing.T) {
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/stream",
		}, nil)

		require.NotNil(t, raw.Response.StatusCode)
		require.Equal(t, int(http.StatusOK), raw.Response.StatusCode)
		require.Contains(t, string(raw.Body), "Hello world from test datasource!")
	})
}

func TestIntegrationDatasourceResourceAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setup(t)

	t.Run("resource endpoint returns 404 for non-existent datasource", func(t *testing.T) {
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/does-not-exist/resource",
		}, nil)

		require.NotNil(t, raw.Status)
		require.Equal(t, int32(http.StatusNotFound), raw.Status.Code)
	})

	t.Run("resource endpoint requires authentication", func(t *testing.T) {
		// None role should not be able to access resource endpoint for GET
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.None,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource",
		}, nil)

		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusForbidden, raw.Response.StatusCode)
	})

	t.Run("resource endpoint cross-org access denied", func(t *testing.T) {
		// OrgB user should not be able to access Org1's datasource resources
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.OrgB.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource",
		}, nil)

		require.NotNil(t, raw.Status)
		require.Equal(t, int32(http.StatusForbidden), raw.Status.Code)
	})
}

func TestIntegrationDatasourceResourcesMethods(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setup(t)

	httpMethods := []string{
		http.MethodGet,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
	}

	for _, method := range httpMethods {
		t.Run(fmt.Sprintf("%s method is forwarded correctly", method), func(t *testing.T) {
			var body []byte
			if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch {
				body = []byte(`{"test": "data"}`)
			}

			raw := apis.DoRequest[testdataResponse](helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: method,
				Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/test/json",
				Body:   body,
			}, &testdataResponse{})

			require.Equal(t, http.StatusOK, raw.Response.StatusCode,
				"method %s should return OK, got: %s", method, string(raw.Body))
			require.NotNil(t, raw.Result)
			require.Equal(t, method, raw.Result.Request.Method,
				"echoed method should match request method")
		})
	}
}

func TestIntegrationDatasourceResourcesScenarios(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := setup(t)

	t.Run("GET /scenarios returns list of available scenarios", func(t *testing.T) {
		raw := apis.DoRequest[[]map[string]any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-resource/resource/scenarios",
		}, &[]map[string]any{})

		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.NotNil(t, raw.Result)

		// Should return a list of scenarios
		scenarios := *raw.Result
		require.NotEmpty(t, scenarios, "should return at least one scenario")

		for _, scenario := range scenarios {
			require.NotEmpty(t, scenario["id"], "scenario should have id")
			require.NotEmpty(t, scenario["name"], "scenario should have name")
		}
	})
}
