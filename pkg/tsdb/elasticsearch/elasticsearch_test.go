package elasticsearch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/require"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type datasourceInfo struct {
	TimeField                  any    `json:"timeField"`
	MaxConcurrentShardRequests any    `json:"maxConcurrentShardRequests,omitempty"`
	Interval                   string `json:"interval"`
}

// mockElasticsearchServer creates a test HTTP server that mocks Elasticsearch cluster info endpoint
func mockElasticsearchServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Return a mock Elasticsearch cluster info response
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"version": map[string]interface{}{
				"build_flavor": "serverless",
				"number":       "8.0.0",
			},
		})
	}))
}

func TestNewInstanceSettings(t *testing.T) {
	t.Run("fields exist", func(t *testing.T) {
		server := mockElasticsearchServer()
		defer server.Close()

		dsInfo := datasourceInfo{
			TimeField:                  "@timestamp",
			MaxConcurrentShardRequests: 5,
		}
		settingsJSON, err := json.Marshal(dsInfo)
		require.NoError(t, err)

		dsSettings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: json.RawMessage(settingsJSON),
		}

		_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
		require.NoError(t, err)
	})

	t.Run("cluster info fails with 403 - should continue with non-serverless defaults", func(t *testing.T) {
		// Create a server that returns 403 Forbidden (simulating restricted permissions)
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}))
		defer server.Close()

		dsInfo := datasourceInfo{
			TimeField:                  "@timestamp",
			MaxConcurrentShardRequests: 5,
		}
		settingsJSON, err := json.Marshal(dsInfo)
		require.NoError(t, err)

		dsSettings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: json.RawMessage(settingsJSON),
		}

		instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
		require.NoError(t, err)
		require.NotNil(t, instance)

		// Verify that the datasource was created with empty (non-serverless) cluster info
		dsInstance := instance.(es.DatasourceInfo)
		require.False(t, dsInstance.ClusterInfo.IsServerless())
		require.Equal(t, "", dsInstance.ClusterInfo.Version.BuildFlavor)
	})

	t.Run("timeField", func(t *testing.T) {
		t.Run("is nil", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.EqualError(t, err, "timeField cannot be cast to string")
		})

		t.Run("is empty", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
				TimeField:                  "",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.EqualError(t, err, "elasticsearch time field name is required")
		})
	})

	t.Run("maxConcurrentShardRequests", func(t *testing.T) {
		t.Run("no maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField: "@timestamp",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("string maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: "10",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("number maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 10,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("zero maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 0,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("negative maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: -10,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("float maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 10.5,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("invalid maxConcurrentShardRequests", func(t *testing.T) {
			server := mockElasticsearchServer()
			defer server.Close()

			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: "invalid",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				URL:      server.URL,
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})
	})
}

func TestCreateElasticsearchURL(t *testing.T) {
	tt := []struct {
		name     string
		settings es.DatasourceInfo
		req      backend.CallResourceRequest
		expected string
	}{
		{name: "with /_msearch path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "_msearch"}, expected: "http://localhost:9200/_msearch"},
		{name: "with _msearch path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "_msearch"}, expected: "http://localhost:9200/_msearch"},
		{name: "with _msearch path and valid url with /", settings: es.DatasourceInfo{URL: "http://localhost:9200/"}, req: backend.CallResourceRequest{Path: "_msearch"}, expected: "http://localhost:9200/_msearch"},
		{name: "with _mapping path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "/_mapping"}, expected: "http://localhost:9200/_mapping"},
		{name: "with /_mapping path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "/_mapping"}, expected: "http://localhost:9200/_mapping"},
		{name: "with /_mapping path and valid url with /", settings: es.DatasourceInfo{URL: "http://localhost:9200/"}, req: backend.CallResourceRequest{Path: "/_mapping"}, expected: "http://localhost:9200/_mapping"},
		{name: "with abc/_mapping path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "abc/_mapping"}, expected: "http://localhost:9200/abc/_mapping"},
		{name: "with /abc/_mapping path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: "abc/_mapping"}, expected: "http://localhost:9200/abc/_mapping"},
		{name: "with /abc/_mapping path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200/"}, req: backend.CallResourceRequest{Path: "abc/_mapping"}, expected: "http://localhost:9200/abc/_mapping"},
		// This is to support mapping for cluster searches that include ":"
		{name: "with path including :", settings: es.DatasourceInfo{URL: "http://localhost:9200/"}, req: backend.CallResourceRequest{Path: "ab:c/_mapping"}, expected: "http://localhost:9200/ab:c/_mapping"},
		{name: "with \"\" path and valid url and /", settings: es.DatasourceInfo{URL: "http://localhost:9200/"}, req: backend.CallResourceRequest{Path: ""}, expected: "http://localhost:9200/"},
		{name: "with \"\" path and valid url", settings: es.DatasourceInfo{URL: "http://localhost:9200"}, req: backend.CallResourceRequest{Path: ""}, expected: "http://localhost:9200/"},
		{name: "with \"\" path and valid url with path", settings: es.DatasourceInfo{URL: "http://elastic:9200/lb"}, req: backend.CallResourceRequest{Path: ""}, expected: "http://elastic:9200/lb/"},
		{name: "with \"\" path and valid url with path and /", settings: es.DatasourceInfo{URL: "http://elastic:9200/lb/"}, req: backend.CallResourceRequest{Path: ""}, expected: "http://elastic:9200/lb/"},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			url, err := createElasticsearchURL(&test.req, &test.settings)
			require.NoError(t, err)
			require.Equal(t, test.expected, url)
		})
	}
}

func TestIsAllowedResourcePath(t *testing.T) {
	tt := []struct {
		name    string
		path    string
		allowed bool
	}{
		{name: "empty path (db version)", path: "", allowed: true},
		{name: "_field_caps", path: "_field_caps", allowed: true},
		{name: "index/_field_caps", path: "myindex/_field_caps", allowed: true},
		{name: "_msearch", path: "_msearch", allowed: true},
		{name: "_mapping", path: "_mapping", allowed: true},
		{name: "index/_mapping", path: "myindex/_mapping", allowed: true},
		{name: "query string on an otherwise-allowed path", path: "myindex/_mapping?pretty=true", allowed: true},
		{name: "unrelated path", path: "_cluster/settings", allowed: false},
		{name: "dot segment", path: "myindex/./_mapping", allowed: false},
		{name: "dot-dot segment escaping the base path", path: "../otherindex/_mapping", allowed: false},
		{name: "dot-dot segment in the middle", path: "myindex/../otherindex/_mapping", allowed: false},
		{name: "bare dot-dot segment", path: "..", allowed: false},
		{name: "literal percent sign", path: "my%2findex/_mapping", allowed: false},
		{name: "literal percent sign confined to the query string is fine, path is unaffected", path: "myindex/_mapping?q=100%25", allowed: true},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.allowed, isAllowedResourcePath(test.path))
		})
	}
}

func TestIsAllowedMethod(t *testing.T) {
	tt := []struct {
		name    string
		path    string
		method  string
		allowed bool
	}{
		{name: "_msearch via POST", path: "_msearch", method: http.MethodPost, allowed: true},
		{name: "_msearch via GET", path: "_msearch", method: http.MethodGet, allowed: false},
		{name: "_msearch via PUT", path: "_msearch", method: http.MethodPut, allowed: false},
		{name: "_mapping via GET", path: "_mapping", method: http.MethodGet, allowed: true},
		{name: "_mapping via PUT (the reported write)", path: "_mapping", method: http.MethodPut, allowed: false},
		{name: "index/_mapping via POST", path: "myindex/_mapping", method: http.MethodPost, allowed: false},
		{name: "_field_caps via GET", path: "_field_caps", method: http.MethodGet, allowed: true},
		{name: "_field_caps via POST", path: "_field_caps", method: http.MethodPost, allowed: false},
		{name: "empty path via GET", path: "", method: http.MethodGet, allowed: true},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.allowed, isAllowedMethod(test.path, test.method))
		})
	}
}

// Test_CallResource_rejectsDisallowedPathsAndMethods exercises the checks through the real
// handler rather than the helper functions in isolation, confirming a rejected call never
// reaches the upstream Elasticsearch request.
func Test_CallResource_rejectsDisallowedPathsAndMethods(t *testing.T) {
	tt := []struct {
		name   string
		path   string
		method string
	}{
		{name: "write to _mapping", path: "myindex/_mapping", method: http.MethodPut},
		{name: "path traversal out of the configured index scope", path: "../otherindex/_mapping", method: http.MethodGet},
		{name: "double-encoded traversal", path: "my%2findex/_mapping", method: http.MethodGet},
		{name: "GET on _msearch", path: "_msearch", method: http.MethodGet},
		{name: "unrelated cluster-settings path", path: "_cluster/settings", method: http.MethodGet},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			var upstreamWasHit bool
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				upstreamWasHit = true
				w.WriteHeader(http.StatusOK)
			}))
			defer upstream.Close()

			ds := newResourceTestService(upstream)

			err := ds.CallResource(context.Background(), &backend.CallResourceRequest{
				Path:   test.path,
				Method: test.method,
			}, backend.CallResourceResponseSenderFunc(func(*backend.CallResourceResponse) error {
				return nil
			}))

			require.Error(t, err)
			require.False(t, upstreamWasHit, "rejected request must never reach Elasticsearch")
		})
	}
}

type staticInstanceManager struct {
	info es.DatasourceInfo
}

func (m *staticInstanceManager) Get(_ context.Context, _ backend.PluginContext) (instancemgmt.Instance, error) {
	return m.info, nil
}

func (*staticInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func newResourceTestService(upstream *httptest.Server) *Service {
	return &Service{
		im: &staticInstanceManager{info: es.DatasourceInfo{
			URL:        upstream.URL,
			HTTPClient: upstream.Client(),
		}},
		logger: log.New(),
	}
}

// Test_CallResource_forwardsAllowedCalls confirms the allowlist doesn't reject the calls this
// plugin actually issues.
func Test_CallResource_forwardsAllowedCalls(t *testing.T) {
	tt := []struct {
		name   string
		path   string
		method string
	}{
		{name: "GET _mapping", path: "_mapping", method: http.MethodGet},
		{name: "GET index/_mapping", path: "myindex/_mapping", method: http.MethodGet},
		{name: "GET _field_caps", path: "_field_caps", method: http.MethodGet},
		{name: "POST _msearch", path: "_msearch", method: http.MethodPost},
		{name: "GET empty path (db version)", path: "", method: http.MethodGet},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			var upstreamWasHit bool
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				upstreamWasHit = true
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{}`))
			}))
			defer upstream.Close()

			ds := newResourceTestService(upstream)

			var captured *backend.CallResourceResponse
			err := ds.CallResource(context.Background(), &backend.CallResourceRequest{
				Path:   test.path,
				Method: test.method,
			}, backend.CallResourceResponseSenderFunc(func(resp *backend.CallResourceResponse) error {
				captured = resp
				return nil
			}))

			require.NoError(t, err)
			require.True(t, upstreamWasHit)
			require.Equal(t, http.StatusOK, captured.Status)
		})
	}
}
