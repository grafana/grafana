package loki

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

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
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", VolumeQuery: true, QueryType: QueryTypeRange})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("non-log-volume queries should not set log-volume http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "", req.Header.Get("X-Query-Tags"))
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", VolumeQuery: false, QueryType: QueryTypeRange})
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
			})

			query := lokiQuery{
				QueryType: QueryTypeRange,
			}

			_, err := api.DataQuery(context.Background(), query)
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
			})

			query := lokiQuery{
				QueryType: QueryTypeInstant,
			}

			_, err := api.DataQuery(context.Background(), query)
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
			})

			_, err := api.RawQuery(context.Background(), "/loki/api/v1/labels?start=1&end=2")
			require.NoError(t, err)
			require.True(t, called)
		})
	}
}
