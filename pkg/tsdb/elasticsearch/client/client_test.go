package es

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_ExecuteMultisearch(t *testing.T) {
	version, err := semver.NewVersion("8.0.0")
	require.NoError(t, err)
	httpClientScenario(t, "Given a fake http client and a v7.0 client with response", &DatasourceInfo{
		Database:                   "[metrics-]YYYY.MM.DD",
		ESVersion:                  version,
		TimeField:                  "@timestamp",
		Interval:                   "Daily",
		MaxConcurrentShardRequests: 6,
		IncludeFrozen:              true,
		XPack:                      true,
	}, func(sc *scenarioContext) {
		sc.responseBody = `{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": { "value": 4656, "relation": "eq"}	},
						"status": 200
					}
				]
			}`

		ms, err := createMultisearchForTest(t, sc.client)
		require.NoError(t, err)
		res, err := sc.client.ExecuteMultisearch(ms)
		require.NoError(t, err)

		require.NotNil(t, sc.request)
		assert.Equal(t, http.MethodPost, sc.request.Method)
		assert.Equal(t, "/_msearch", sc.request.URL.Path)
		assert.Equal(t, "max_concurrent_shard_requests=6&ignore_throttled=false", sc.request.URL.RawQuery)

		require.NotNil(t, sc.requestBody)

		headerBytes, err := sc.requestBody.ReadBytes('\n')
		require.NoError(t, err)
		bodyBytes := sc.requestBody.Bytes()

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
}

func createMultisearchForTest(t *testing.T, c Client) (*MultiSearchRequest, error) {
	t.Helper()

	msb := c.MultiSearch()
	s := msb.Search(intervalv2.Interval{Value: 15 * time.Second, Text: "15s"})
	s.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.FixedInterval = "$__interval"

		ab.Metric("1", "avg", "@hostname", func(a *MetricAggregation) {
			a.Settings["script"] = "$__interval_ms*@hostname"
		})
	})
	return msb.Build()
}

type scenarioContext struct {
	client         Client
	request        *http.Request
	requestBody    *bytes.Buffer
	responseStatus int
	responseBody   string
}

type scenarioFunc func(*scenarioContext)

func httpClientScenario(t *testing.T, desc string, ds *DatasourceInfo, fn scenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		sc := &scenarioContext{
			responseStatus: 200,
			responseBody:   `{ "responses": [] }`,
		}
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			sc.request = r
			buf, err := io.ReadAll(r.Body)
			require.NoError(t, err)

			sc.requestBody = bytes.NewBuffer(buf)

			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err = rw.Write([]byte(sc.responseBody))
			require.NoError(t, err)
			rw.WriteHeader(sc.responseStatus)
		}))
		ds.URL = ts.URL

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, timeRange)
		require.NoError(t, err)
		require.NotNil(t, c)
		sc.client = c

		currentNewDatasourceHTTPClient := newDatasourceHttpClient

		newDatasourceHttpClient = func(httpClientProvider httpclient.Provider, ds *DatasourceInfo) (*http.Client, error) {
			return ts.Client(), nil
		}

		t.Cleanup(func() {
			ts.Close()
			newDatasourceHttpClient = currentNewDatasourceHTTPClient
		})

		fn(sc)
	})
}
