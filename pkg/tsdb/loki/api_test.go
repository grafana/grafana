package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsVolume, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("logs sample queries should set logs sample http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=logsample", req.Header.Get("X-Query-Tags"))
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsSample, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("X-Loki-Query-Limits-Context header should be set when LimitsContext is provided", func(t *testing.T) {
		called := false
		from := time.Now().Truncate(time.Millisecond).Add(-1 * time.Hour)
		to := time.Now().Truncate(time.Millisecond)
		limitsContext := LimitsContext{
			Expr: "{cluster=\"us-central1\"}",
			From: from,
			To:   to,
		}

		limitsContextJson, _ := json.Marshal(limitsContext)
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, string(limitsContextJson), req.Header.Get("X-Loki-Query-Limits-Context"))
		})
		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsSample, QueryType: QueryTypeRange, LimitsContext: limitsContext}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("X-Loki-Query-Limits-Context header should not get set when LimitsContext is missing expr", func(t *testing.T) {
		called := false
		from := time.Now().Truncate(time.Millisecond).Add(-1 * time.Hour)
		to := time.Now().Truncate(time.Millisecond)
		limitsContext := LimitsContext{
			Expr: "",
			From: from,
			To:   to,
		}

		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "", req.Header.Get("X-Loki-Query-Limits-Context"))
		})
		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsSample, QueryType: QueryTypeRange, LimitsContext: limitsContext}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("X-Loki-Query-Limits-Context header should not get set when LimitsContext is not provided", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "", req.Header.Get("X-Loki-Query-Limits-Context"))
		})
		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsSample, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("data sample queries should set data sample http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=datasample", req.Header.Get("X-Query-Tags"))
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryDataSample, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("none queries should not set X-Query-Tags http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "", req.Header.Get("X-Query-Tags"))
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryNone, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("any defined supporting query should not set X-Query-Tags http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "Source=foo", req.Header.Get("X-Query-Tags"))
		})

		_, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryType("foo"), QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("should set correct http header", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", response, func(req *http.Request) {
			called = true
			require.Equal(t, "categorize-labels", req.Header.Get("X-Loki-Response-Encoding-Flags"))
		})

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
		})

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
			})

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
			})

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
			})

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
		require.Equal(t, 400, encodedBytes.Status)
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

	t.Run("should set status for successful requests", func(t *testing.T) {
		called := false
		api := makeMockedAPI(200, "application/json", []byte("{\"message\":\"foo\"}"), func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{Expr: "", SupportingQueryType: SupportingQueryLogsVolume, QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.Equal(t, backend.Status(http.StatusOK), res.Status)
	})
}

func TestErrorSources(t *testing.T) {
	errorResponse := []byte(`{"message": "test error"}`)

	t.Run("should set correct error source for downstream errors", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusBadRequest, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, res.Error)
		require.Equal(t, backend.ErrorSourceDownstream, res.ErrorSource)
		require.Equal(t, backend.Status(http.StatusBadRequest), res.Status)
	})

	t.Run("should set correct error source for plugin errors", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusNotAcceptable, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, res.Error)
		require.Equal(t, backend.ErrorSourcePlugin, res.ErrorSource)
		require.Equal(t, backend.Status(http.StatusNotAcceptable), res.Status)
	})

	t.Run("should set correct error source for server errors", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusInternalServerError, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, res.Error)
		require.Equal(t, backend.ErrorSourceDownstream, res.ErrorSource)
		require.Equal(t, backend.Status(http.StatusInternalServerError), res.Status)
	})

	t.Run("should set correct error source for server timeout error", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusGatewayTimeout, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, res.Error)
		require.Equal(t, backend.ErrorSourceDownstream, res.ErrorSource)
		require.Equal(t, backend.Status(http.StatusGatewayTimeout), res.Status)
	})

	t.Run("should handle downstream HTTP errors", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusBadRequest, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.DataQuery(context.Background(), lokiQuery{QueryType: QueryTypeRange}, ResponseOpts{})
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, res.Error)
		require.Equal(t, backend.ErrorSourceDownstream, res.ErrorSource)
		require.Contains(t, res.Error.Error(), "test error")
		require.Equal(t, backend.Status(http.StatusBadRequest), res.Status)
	})

	t.Run("should handle client errors in RawQuery", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusBadRequest, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.RawQuery(context.Background(), "/loki/api/v1/labels")
		require.NoError(t, err)
		require.True(t, called)
		require.Equal(t, http.StatusBadRequest, res.Status)
		require.Contains(t, string(res.Body), "test error")
	})

	t.Run("should handle server errors in RawQuery", func(t *testing.T) {
		called := false
		api := makeMockedAPI(http.StatusInternalServerError, "application/json", errorResponse, func(req *http.Request) {
			called = true
		})

		res, err := api.RawQuery(context.Background(), "/loki/api/v1/labels")
		require.Error(t, err)
		require.True(t, called)
		require.Contains(t, err.Error(), "test error")
		// Status code of 0 gets mapped to InternalServerError (500)
		require.Equal(t, 0, res.Status)
	})
}
