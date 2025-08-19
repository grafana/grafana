package es

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestClient_ExecuteMultisearch(t *testing.T) {
	t.Run("Given a fake http client and a client with response", func(t *testing.T) {
		var request *http.Request
		var requestBody *bytes.Buffer

		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			request = r
			buf, err := io.ReadAll(r.Body)
			require.NoError(t, err)

			requestBody = bytes.NewBuffer(buf)

			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err = rw.Write([]byte(
				`{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": { "value": 4656, "relation": "eq"}	},
						"status": 200
					}
				]
			}`))
			require.NoError(t, err)
			rw.WriteHeader(200)
		}))

		configuredFields := ConfiguredFields{
			TimeField:       "testtime",
			LogMessageField: "line",
			LogLevelField:   "lvl",
		}

		ds := DatasourceInfo{
			URL:                        ts.URL,
			HTTPClient:                 ts.Client(),
			Database:                   "[metrics-]YYYY.MM.DD",
			ConfiguredFields:           configuredFields,
			Interval:                   "Daily",
			MaxConcurrentShardRequests: 6,
			IncludeFrozen:              true,
		}

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		c, err := NewClient(context.Background(), &ds, log.New())
		require.NoError(t, err)
		require.NotNil(t, c)

		t.Cleanup(func() {
			ts.Close()
		})

		ms, err := createMultisearchForTest(t, c, timeRange)
		require.NoError(t, err)
		res, err := c.ExecuteMultisearch(ms)
		require.NoError(t, err)

		require.NotNil(t, request)
		assert.Equal(t, http.MethodPost, request.Method)
		assert.Equal(t, "/_msearch", request.URL.Path)
		assert.Equal(t, "max_concurrent_shard_requests=6&ignore_throttled=false", request.URL.RawQuery)

		require.NotNil(t, requestBody)

		headerBytes, err := requestBody.ReadBytes('\n')
		require.NoError(t, err)
		bodyBytes := requestBody.Bytes()

		jHeader, err := simplejson.NewJson(headerBytes)
		require.NoError(t, err)

		jBody, err := simplejson.NewJson(bodyBytes)
		require.NoError(t, err)

		assert.Equal(t, "metrics-2018.05.15", jHeader.Get("index").MustString())
		assert.True(t, jHeader.Get("ignore_unavailable").MustBool(false))
		assert.Equal(t, "query_then_fetch", jHeader.Get("search_type").MustString())
		assert.Empty(t, jHeader.Get("max_concurrent_shard_requests"))
		assert.False(t, jHeader.Get("ignore_throttled").MustBool())

		assert.Equal(t, "15000*@hostname", jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString())

		assert.Equal(t, "15s", jBody.GetPath("aggs", "2", "date_histogram", "fixed_interval").MustString())

		assert.Equal(t, 200, res.Status)
		require.Len(t, res.Responses, 1)
	})

	t.Run("Given a fake http client, 2 queries and a client with response", func(t *testing.T) {
		var requestBody *bytes.Buffer
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			buf, err := io.ReadAll(r.Body)
			require.NoError(t, err)

			requestBody = bytes.NewBuffer(buf)

			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err = rw.Write([]byte(
				`{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": { "value": 4656, "relation": "eq"}	},
						"status": 200
					}
				]
			}`))
			require.NoError(t, err)
			rw.WriteHeader(200)
		}))

		configuredFields := ConfiguredFields{
			TimeField:       "testtime",
			LogMessageField: "line",
			LogLevelField:   "lvl",
		}

		ds := DatasourceInfo{
			URL:                        ts.URL,
			HTTPClient:                 ts.Client(),
			Database:                   "[metrics-]YYYY.MM.DD",
			ConfiguredFields:           configuredFields,
			Interval:                   "Daily",
			MaxConcurrentShardRequests: 6,
			IncludeFrozen:              true,
		}

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		from2 := time.Date(2018, 5, 17, 17, 50, 0, 0, time.UTC)
		to2 := time.Date(2018, 5, 17, 17, 55, 0, 0, time.UTC)
		timeRange2 := backend.TimeRange{
			From: from2,
			To:   to2,
		}

		c, err := NewClient(context.Background(), &ds, log.New())
		require.NoError(t, err)
		require.NotNil(t, c)

		t.Cleanup(func() {
			ts.Close()
		})

		ms, err := createMultisearchWithMultipleQueriesForTest(t, c, timeRange, timeRange2)
		require.NoError(t, err)
		_, err = c.ExecuteMultisearch(ms)
		require.NoError(t, err)

		require.NotNil(t, requestBody)

		bodyString := requestBody.String()
		require.Contains(t, bodyString, "metrics-2018.05.15")
		require.Contains(t, bodyString, "metrics-2018.05.17")
	})

	t.Run("Should return DownstreamError when index is invalid", func(t *testing.T) {
		ds := &DatasourceInfo{
			URL:      "test",
			Database: "index-with-no-pattern",
			Interval: intervalMonthly,
		}

		c, err := NewClient(context.Background(), ds, log.NewNullLogger())
		require.NoError(t, err)

		_, err = c.ExecuteMultisearch(&MultiSearchRequest{Requests: []*SearchRequest{{}}})
		assert.Equal(t, "failed to get indices from index pattern. invalid index pattern index-with-no-pattern. Specify an index with a time pattern or select 'No pattern'", err.Error())
		require.True(t, backend.IsDownstreamError(err))
	})

	t.Run("Should return DownstreamError when decoding response fails", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err := rw.Write([]byte(`{"invalid`))
			require.NoError(t, err)
			rw.WriteHeader(200)
		}))

		ds := &DatasourceInfo{
			URL:        ts.URL,
			Database:   "[metrics-]YYYY.MM.DD",
			HTTPClient: ts.Client(),
		}

		c, err := NewClient(context.Background(), ds, log.NewNullLogger())
		require.NoError(t, err)

		t.Cleanup(func() {
			ts.Close()
		})

		_, err = c.ExecuteMultisearch(&MultiSearchRequest{})
		require.Error(t, err)
		require.True(t, backend.IsDownstreamError(err))
	})
}

func TestClient_Index(t *testing.T) {
	tt := []struct {
		name                string
		indexInDatasource   string
		patternInDatasource string
		indexInRequest      string
	}{
		{
			name:                "empty string",
			indexInDatasource:   "",
			patternInDatasource: "",
			indexInRequest:      "",
		},
		{
			name:                "single string",
			indexInDatasource:   "logs-*",
			patternInDatasource: "",
			indexInRequest:      "logs-*",
		},
		{
			name:                "daily pattern",
			indexInDatasource:   "[logs-]YYYY.MM.DD",
			patternInDatasource: "Daily",
			indexInRequest:      "logs-2018.05.10,logs-2018.05.11,logs-2018.05.12",
		},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			var request *http.Request
			var requestBody *bytes.Buffer

			ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				request = r
				buf, err := io.ReadAll(r.Body)
				require.NoError(t, err)

				requestBody = bytes.NewBuffer(buf)

				rw.Header().Set("Content-Type", "application/x-ndjson")
				_, err = rw.Write([]byte(
					`{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": { "value": 4656, "relation": "eq"}	},
						"status": 200
					}
				]
			}`))
				require.NoError(t, err)
				rw.WriteHeader(200)
			}))

			configuredFields := ConfiguredFields{
				TimeField:       "testtime",
				LogMessageField: "line",
				LogLevelField:   "lvl",
			}

			ds := DatasourceInfo{
				URL:                        ts.URL,
				HTTPClient:                 ts.Client(),
				Database:                   test.indexInDatasource,
				ConfiguredFields:           configuredFields,
				Interval:                   test.patternInDatasource,
				MaxConcurrentShardRequests: 6,
				IncludeFrozen:              true,
			}

			from := time.Date(2018, 5, 10, 17, 50, 0, 0, time.UTC)
			to := time.Date(2018, 5, 12, 17, 55, 0, 0, time.UTC)
			timeRange := backend.TimeRange{
				From: from,
				To:   to,
			}

			c, err := NewClient(context.Background(), &ds, log.New())
			require.NoError(t, err)
			require.NotNil(t, c)

			t.Cleanup(func() {
				ts.Close()
			})

			ms, err := createMultisearchForTest(t, c, timeRange)
			require.NoError(t, err)
			_, err = c.ExecuteMultisearch(ms)
			require.NoError(t, err)

			require.NotNil(t, request)
			require.NotNil(t, requestBody)

			headerBytes, err := requestBody.ReadBytes('\n')
			require.NoError(t, err)

			jHeader, err := simplejson.NewJson(headerBytes)
			require.NoError(t, err)

			assert.Equal(t, test.indexInRequest, jHeader.Get("index").MustString())
		})
	}
}

func TestStreamMultiSearchResponse_Success(t *testing.T) {
	jsonBody := `
    {
        "responses": [
            { "hits": { "hits": [] } },
            { "hits": { "hits": [] } }
        ]
    }`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(msr.Responses) != 2 {
		t.Errorf("expected 2 responses, got %d", len(msr.Responses))
	}
}

func TestStreamMultiSearchResponse_MalformedJSON(t *testing.T) {
	jsonBody := `
    {
        "responses": [
            { "hits": { "hits": [] } }
    ` // Missing closing braces

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err == nil {
		t.Fatalf("expected an error, got none")
	}
}

func TestStreamMultiSearchResponse_MissingResponses(t *testing.T) {
	jsonBody := `
    {
        "something_else": [
            { "hits": { "hits": [] } }
        ]
    }`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(msr.Responses) != 0 {
		t.Errorf("expected 0 responses, got %d", len(msr.Responses))
	}
}

func TestStreamMultiSearchResponse_EmptyBody(t *testing.T) {
	jsonBody := `{}`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(msr.Responses) != 0 {
		t.Errorf("expected 0 responses, got %d", len(msr.Responses))
	}
}

func TestStreamMultiSearchResponse_InvalidJSONStart(t *testing.T) {
	jsonBody := `invalid_json`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err == nil {
		t.Fatalf("expected an error due to invalid JSON, got none")
	}
}

func TestStreamMultiSearchResponse_InvalidHitsField(t *testing.T) {
	jsonBody := `
    {
        "responses": [
            { "hits": "invalid_string_value" }
        ]
    }`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err == nil {
		t.Fatalf("expected an error due to invalid 'hits' field, got none")
	}

	if err.Error() != "expected '{' for hits object, got invalid_string_value" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestStreamMultiSearchResponse_InvalidHitElement(t *testing.T) {
	jsonBody := `
    {
        "responses": [
            { "hits": { "hits": ["invalid_element"] } }
        ]
    }`

	msr := &MultiSearchResponse{}
	err := StreamMultiSearchResponse(strings.NewReader(jsonBody), msr)

	if err == nil {
		t.Fatalf("expected an error due to invalid element in 'hits' array, got none")
	}

	expected := "json: cannot unmarshal string into Go value of type map[string]interface {}"
	if err.Error() != expected {
		t.Errorf("unexpected error message: expected %v, got %v", expected, err)
	}
}

func TestStreamMultiSearchResponse_ErrorHandling(t *testing.T) {
	t.Run("Given invalid elasticsearch responses", func(t *testing.T) {
		t.Run("When response is invalid JSON", func(t *testing.T) {
			msr := &MultiSearchResponse{}
			err := StreamMultiSearchResponse(strings.NewReader(`abc`), msr)

			require.Error(t, err)
			require.True(t, backend.IsDownstreamError(err))
		})
	})

	t.Run("Given a client with invalid response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err := rw.Write([]byte(`{"invalid`))
			require.NoError(t, err)
			rw.WriteHeader(200)
		}))

		ds := &DatasourceInfo{
			URL:        ts.URL,
			Database:   "[metrics-]YYYY.MM.DD",
			HTTPClient: ts.Client(),
		}

		c, err := NewClient(context.Background(), ds, log.NewNullLogger())
		require.NoError(t, err)

		t.Cleanup(func() {
			ts.Close()
		})

		t.Run("When executing multi search with invalid response", func(t *testing.T) {
			_, err = c.ExecuteMultisearch(&MultiSearchRequest{})
			require.Error(t, err)
			require.True(t, backend.IsDownstreamError(err))
		})
	})
}

func createMultisearchForTest(t *testing.T, c Client, timeRange backend.TimeRange) (*MultiSearchRequest, error) {
	t.Helper()

	msb := c.MultiSearch()
	s := msb.Search(15*time.Second, timeRange)
	s.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.FixedInterval = "$__interval"

		ab.Metric("1", "avg", "@hostname", func(a *MetricAggregation) {
			a.Settings["script"] = "$__interval_ms*@hostname"
		})
	})
	return msb.Build()
}

func createMultisearchWithMultipleQueriesForTest(t *testing.T, c Client, firstTimeRange backend.TimeRange, secondTimeRange backend.TimeRange) (*MultiSearchRequest, error) {
	t.Helper()

	msb := c.MultiSearch()
	s1 := msb.Search(15*time.Second, firstTimeRange)
	s1.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.FixedInterval = "$__interval"

		ab.Metric("1", "avg", "@hostname", func(a *MetricAggregation) {
			a.Settings["script"] = "$__interval_ms*@hostname"
		})
	})

	s2 := msb.Search(15*time.Second, secondTimeRange)
	s2.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.FixedInterval = "$__interval"

		ab.Metric("1", "avg", "@hostname", func(a *MetricAggregation) {
			a.Settings["script"] = "$__interval_ms*@hostname"
		})
	})

	return msb.Build()
}
