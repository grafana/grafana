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
