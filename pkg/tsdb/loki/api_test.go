package loki

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
	"github.com/stretchr/testify/require"
)

func TestApiLogVolume(t *testing.T) {
	response := []byte(`
	{
		"status": "success",
		"data": {
			"resultType" : "matrix",
			"result": []
		}
	}
	`)

	t.Run("log-volume queries should set log-volume http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=logvolhist", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsVolume, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("logs sample queries should set logs sample http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=logsample", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsSample, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("data sample queries should set data sample http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=datasample", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryDataSample, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("none queries should not set X-Query-Tags http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryNone, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("any defined supporting query should not set X-Query-Tags http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=foo", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryType("foo"), QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("with `structuredMetadata` should set correct http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "categorize-labels", req.Header.Get("X-Loki-Response-Encoding-Flags"))
		}, true)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsVolume, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})
}

func TestInfiniteScroll(t *testing.T) {
	response := []byte(`
	{
		"status": "success",
		"data": {
			"resultType" : "matrix",
			"result": []
		}
	}
	`)

	t.Run("infinite scrolling queries should set infinite scroll http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=infinitescroll", req.Header.Get("X-Query-Tags"))
		}, false)

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: dataquery.SupportingQueryTypeInfiniteScroll, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})
}

func TestApiUrlHandling(t *testing.T) {
	response := []byte(`
	{
		"status": "success",
		"data": {
			"resultType" : "matrix",
			"result": []
		}
	}
	`)

	queryTestData := []struct {
		name               string
		dsUrl              string
		rangeQueryPrefix   string
		instantQueryPrefix string
		metaUrl            string
	}{
		{
			name:               "no path in datasource-config",
			dsUrl:              "http://localhost:3100",
			rangeQueryPrefix:   "http://localhost:3100/loki/api/v1/query_range?",
			instantQueryPrefix: "http://localhost:3100/loki/api/v1/query?",
			metaUrl:            "http://localhost:3100/loki/api/v1/labels?start=1&end=2",
		},
		{
			name:               "just a slash path in datasource-config",
			dsUrl:              "http://localhost:3100/",
			rangeQueryPrefix:   "http://localhost:3100/loki/api/v1/query_range?",
			instantQueryPrefix: "http://localhost:3100/loki/api/v1/query?",
			metaUrl:            "http://localhost:3100/loki/api/v1/labels?start=1&end=2",
		},
		{
			name:               "when path-without-end-slash in datasource-config",
			dsUrl:              "http://localhost:3100/a/b/c",
			rangeQueryPrefix:   "http://localhost:3100/a/b/c/loki/api/v1/query_range?",
			instantQueryPrefix: "http://localhost:3100/a/b/c/loki/api/v1/query?",
			metaUrl:            "http://localhost:3100/a/b/c/loki/api/v1/labels?start=1&end=2",
		},
		{
			name:               "path-with-end-slash in datasource-config",
			dsUrl:              "http://localhost:3100/a/b/c/",
			rangeQueryPrefix:   "http://localhost:3100/a/b/c/loki/api/v1/query_range?",
			instantQueryPrefix: "http://localhost:3100/a/b/c/loki/api/v1/query?",
			metaUrl:            "http://localhost:3100/a/b/c/loki/api/v1/labels?start=1&end=2",
		},
	}

	for _, test := range queryTestData {
		t.Run("Loki should build the range-query URL correctly when "+test.name, func(t *testing.T) {
			called := false
			api := makeMockedAPIWithUrl(test.dsUrl, 200, "application/json", response, func(req *http.Request) {
				called = true
				urlString := req.URL.String()
				wantedPrefix := test.rangeQueryPrefix
				failMessage := fmt.Sprintf(`wanted prefix: [%s], got string [%s]`, wantedPrefix, urlString)
				require.True(t, strings.HasPrefix(urlString, wantedPrefix), failMessage)
			}, false)

			query := lokiQuery{
				QueryType: QueryTypeRange,
			}

			_, err := api.DataQuery(context.Background(), query, ResponseOpts{})
			require.NoError(t, err)
			require.True(t, called)
		})
	}

	for _, test := range queryTestData {
		t.Run("Loki should build the instant-query URL correctly when "+test.name, func(t *testing.T) {
			called := false
			api := makeMockedAPIWithUrl(test.dsUrl, 200, "application/json", response, func(req *http.Request) {
				called = true
				urlString := req.URL.String()
				wantedPrefix := test.instantQueryPrefix
				failMessage := fmt.Sprintf(`wanted prefix: [%s], got string [%s]`, wantedPrefix, urlString)
				require.True(t, strings.HasPrefix(urlString, wantedPrefix), failMessage)
			}, false)

			query := lokiQuery{
				QueryType: QueryTypeInstant,
			}

			_, err := api.DataQuery(context.Background(), query, ResponseOpts{})
			require.NoError(t, err)
			require.True(t, called)
		})
	}

	for _, test := range queryTestData {
		t.Run("Loki should build the metadata query URL correctly when "+test.name, func(t *testing.T) {
			called := false
			api := makeMockedAPIWithUrl(test.dsUrl, 200, "application/json", response, func(req *http.Request) {
				called = true
				require.Equal(t, test.metaUrl, req.URL.String())
			}, false)

			_, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
			require.NoError(t, err)
			require.True(t, called)
		})
	}
}

func TestApiReturnValues(t *testing.T) {
	t.Run("Loki should return the right encoding", func(t *testing.T) {
		called := false
		api := makeCompressedMockedAPIWithUrl("http://localhost:3100", 200, "application/json", []byte("foo"), func(req *http.Request) {
			called = true
		})

		encodedBytes, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
		require.NoError(t, err)
		require.True(t, called)
		require.Equal(t, "gzip", encodedBytes.Encoding)
		require.Equal(t, []byte("foo"), encodedBytes.Body)
	})

	t.Run("Loki should return the error as message", func(t *testing.T) {
		called := false
		api := makeCompressedMockedAPIWithUrl("http://localhost:3100", 400, "application/json", []byte("foo"), func(req *http.Request) {
			called = true
		})

		encodedBytes, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
		require.NoError(t, err)
		require.True(t, called)
		require.Equal(t, "gzip", encodedBytes.Encoding)
		require.Equal(t, []byte("{\"message\":\"foo\"}"), encodedBytes.Body)
	})

	t.Run("Loki should return the error as is", func(t *testing.T) {
		called := false
		api := makeCompressedMockedAPIWithUrl("http://localhost:3100", 400, "application/json", []byte("{\"message\":\"foo\"}"), func(req *http.Request) {
			called = true
		})

		encodedBytes, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
		require.NoError(t, err)
		require.True(t, called)
		require.Equal(t, "gzip", encodedBytes.Encoding)
		require.Equal(t, []byte("{\"message\":\"foo\"}"), encodedBytes.Body)
	})

	t.Run("Loki should not return the error on 500", func(t *testing.T) {
		api := makeCompressedMockedAPIWithUrl("http://localhost:3100", 500, "application/json", []byte("foo"), nil)

		_, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
		require.Error(t, err)
		require.ErrorContains(t, err, "foo")
	})

	t.Run("Loki should not return the error on 500 in JSON", func(t *testing.T) {
		api := makeCompressedMockedAPIWithUrl("http://localhost:3100", 500, "application/json", []byte("{\"message\":\"foo\"}"), nil)

		_, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
		require.Error(t, err)
		require.ErrorContains(t, err, "foo")
	})
}

func TestMakeRawRequest(t *testing.T) {
	ctx := context.Background()
	lokiDsUrl := "http://localhost:3100"

	tests := []struct {
		name          string
		resourcePath  string
		expectedPath  string
		expectedQuery string
		description   string
	}{
		{
			name:          "basic path without encoding",
			resourcePath:  "/loki/api/v1/labels",
			expectedPath:  "/loki/api/v1/labels",
			expectedQuery: "",
			description:   "Should handle basic path without any encoding",
		},
		{
			name:          "path with encoded spaces",
			resourcePath:  "/loki/api/v1/label/my%20label/values",
			expectedPath:  "/loki/api/v1/label/my%20label/values",
			expectedQuery: "",
			description:   "Should preserve %20 encoding for spaces in path segments",
		},
		{
			name:          "path with encoded special characters",
			resourcePath:  "/loki/api/v1/label/label%40with%23special%24chars/values",
			expectedPath:  "/loki/api/v1/label/label%40with%23special%24chars/values",
			expectedQuery: "",
			description:   "Should preserve encoding for special characters (@#$)",
		},
		{
			name:          "path with encoded slashes",
			resourcePath:  "/loki/api/v1/label/path%2Fwith%2Fslashes/values",
			expectedPath:  "/loki/api/v1/label/path%2Fwith%2Fslashes/values",
			expectedQuery: "",
			description:   "Should preserve %2F encoding for slashes in path segments",
		},
		{
			name:          "path with query parameters",
			resourcePath:  "/loki/api/v1/labels?start=2023-01-01T00:00:00Z&end=2023-01-01T01:00:00Z",
			expectedPath:  "/loki/api/v1/labels",
			expectedQuery: "start=2023-01-01T00:00:00Z&end=2023-01-01T01:00:00Z",
			description:   "Should separate path and query parameters correctly",
		},
		{
			name:          "encoded path with query parameters",
			resourcePath:  "/loki/api/v1/label/my%20label/values?query=%7Bservice%3D%22auth%22%7D",
			expectedPath:  "/loki/api/v1/label/my%20label/values",
			expectedQuery: "query=%7Bservice%3D%22auth%22%7D",
			description:   "Should preserve encoding in both path and query parameters",
		},
		{
			name:          "multiple encoded segments",
			resourcePath:  "/loki/api/v1/label/env%3Aproduction%2Fservice%40auth/values",
			expectedPath:  "/loki/api/v1/label/env%3Aproduction%2Fservice%40auth/values",
			expectedQuery: "",
			description:   "Should preserve encoding across multiple path segments",
		},
		{
			name:          "path with plus encoding",
			resourcePath:  "/loki/api/v1/label/label+with+plus/values",
			expectedPath:  "/loki/api/v1/label/label+with+plus/values",
			expectedQuery: "",
			description:   "Should preserve + characters in path segments",
		},
		{
			name:          "path with mixed encoding",
			resourcePath:  "/loki/api/v1/label/mixed%20encoding+and%2Fspecial%40chars/values?filter=value%2Bwith%2Bplus",
			expectedPath:  "/loki/api/v1/label/mixed%20encoding+and%2Fspecial%40chars/values",
			expectedQuery: "filter=value%2Bwith%2Bplus",
			description:   "Should handle mixed encoding types correctly",
		},
		{
			name:          "path with unicode encoding",
			resourcePath:  "/loki/api/v1/label/unicode%E2%9C%93check/values",
			expectedPath:  "/loki/api/v1/label/unicode%E2%9C%93check/values",
			expectedQuery: "",
			description:   "Should preserve Unicode character encoding",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := makeRawRequest(ctx, lokiDsUrl, tt.resourcePath)
			require.NoError(t, err, "makeRawRequest should not return an error")
			require.NotNil(t, req, "Request should not be nil")

			// Test the path
			require.Equal(t, tt.expectedPath, req.URL.Path, tt.description+" - path mismatch")

			// Test the query
			require.Equal(t, tt.expectedQuery, req.URL.RawQuery, tt.description+" - query mismatch")

			// Test the base URL is preserved
			require.Equal(t, "localhost:3100", req.URL.Host, "Host should be preserved")
			require.Equal(t, "http", req.URL.Scheme, "Scheme should be preserved")

			// Test the method
			require.Equal(t, "GET", req.Method, "Method should be GET")

			// Test context
			require.Equal(t, ctx, req.Context(), "Context should be preserved")
		})
	}
}

func TestMakeRawRequest_Errors(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid loki URL", func(t *testing.T) {
		invalidUrl := "://invalid-url"
		resourcePath := "/loki/api/v1/labels"

		req, err := makeRawRequest(ctx, invalidUrl, resourcePath)
		require.Error(t, err, "Should return error for invalid loki URL")
		require.Nil(t, req, "Request should be nil on error")
	})

	t.Run("invalid resource path", func(t *testing.T) {
		lokiDsUrl := "http://localhost:3100"
		invalidResourcePath := "://invalid-resource-path"

		req, err := makeRawRequest(ctx, lokiDsUrl, invalidResourcePath)
		require.Error(t, err, "Should return error for invalid resource path")
		require.Nil(t, req, "Request should be nil on error")
	})
}

func TestMakeRawRequest_ComplexScenarios(t *testing.T) {
	ctx := context.Background()
	lokiDsUrl := "https://loki.example.com:9090/custom/path"

	t.Run("complex base URL with encoded resource path", func(t *testing.T) {
		resourcePath := "/loki/api/v1/label/complex%2Flabel%40name/values?start=2023-01-01&query=%7Bapp%3D%22test%22%7D"

		req, err := makeRawRequest(ctx, lokiDsUrl, resourcePath)
		require.NoError(t, err)
		require.NotNil(t, req)

		// The path should join the base URL path with the resource path
		expectedPath := "/custom/path/loki/api/v1/label/complex%2Flabel%40name/values"
		require.Equal(t, expectedPath, req.URL.Path)

		expectedQuery := "start=2023-01-01&query=%7Bapp%3D%22test%22%7D"
		require.Equal(t, expectedQuery, req.URL.RawQuery)

		require.Equal(t, "loki.example.com:9090", req.URL.Host)
		require.Equal(t, "https", req.URL.Scheme)
	})

	t.Run("resource path with fragment", func(t *testing.T) {
		// Note: fragments are typically not used in server requests and are not sent to servers
		resourcePath := "/loki/api/v1/labels#fragment"

		req, err := makeRawRequest(ctx, lokiDsUrl, resourcePath)
		require.NoError(t, err)
		require.NotNil(t, req)

		// Fragment should be empty in server requests (standard HTTP behavior)
		require.Equal(t, "", req.URL.Fragment)
		require.Equal(t, "/custom/path/loki/api/v1/labels", req.URL.Path)
	})
}
