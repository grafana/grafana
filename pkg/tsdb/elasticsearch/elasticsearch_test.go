package elasticsearch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type datasourceInfo struct {
	TimeField                  any    `json:"timeField"`
	MaxConcurrentShardRequests any    `json:"maxConcurrentShardRequests,omitempty"`
	Interval                   string `json:"interval"`
}

func TestNewInstanceSettings(t *testing.T) {
	t.Run("fields exist", func(t *testing.T) {
		dsInfo := datasourceInfo{
			TimeField:                  "@timestamp",
			MaxConcurrentShardRequests: 5,
		}
		settingsJSON, err := json.Marshal(dsInfo)
		require.NoError(t, err)

		dsSettings := backend.DataSourceInstanceSettings{
			JSONData: json.RawMessage(settingsJSON),
		}

		_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
		require.NoError(t, err)
	})

	t.Run("timeField", func(t *testing.T) {
		t.Run("is nil", func(t *testing.T) {
			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.EqualError(t, err, "timeField cannot be cast to string")
		})

		t.Run("is empty", func(t *testing.T) {
			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
				TimeField:                  "",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.EqualError(t, err, "elasticsearch time field name is required")
		})
	})

	t.Run("maxConcurrentShardRequests", func(t *testing.T) {
		t.Run("no maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField: "@timestamp",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("string maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: "10",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("number maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 10,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("zero maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 0,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("negative maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: -10,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, defaultMaxConcurrentShardRequests, instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("float maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: 10.5,
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			instance, err := newInstanceSettings(httpclient.NewProvider())(context.Background(), dsSettings)
			require.Equal(t, int64(10), instance.(es.DatasourceInfo).MaxConcurrentShardRequests)
			require.NoError(t, err)
		})

		t.Run("invalid maxConcurrentShardRequests", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
				MaxConcurrentShardRequests: "invalid",
			}
			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
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
		// This is to support mappings to cross cluster search that includes ":"
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
