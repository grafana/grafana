package es

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClient(t *testing.T) {
	t.Run("When no version set should return error", func(t *testing.T) {
		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(make(map[string]interface{})),
		}

		_, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
		require.Error(t, err)
	})

	t.Run("When no time field name set should return error", func(t *testing.T) {
		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": 5,
			}),
		}

		_, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
		require.Error(t, err)
	})

	t.Run("When using legacy version numbers", func(t *testing.T) {
		t.Run("When unsupported version set should return error", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 6,
					"timeField": "@timestamp",
				}),
			}

			_, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.Error(t, err)
		})

		t.Run("When version 2 should return v2 client", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 2,
					"timeField": "@timestamp",
				}),
			}

			c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.NoError(t, err)
			assert.Equal(t, "2.0.0", c.GetVersion().String())
		})

		t.Run("When version 5 should return v5 client", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 5,
					"timeField": "@timestamp",
				}),
			}

			c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.NoError(t, err)
			assert.Equal(t, "5.0.0", c.GetVersion().String())
		})

		t.Run("When version 56 should return v5.6 client", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 56,
					"timeField": "@timestamp",
				}),
			}

			c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.NoError(t, err)
			assert.Equal(t, "5.6.0", c.GetVersion().String())
		})

		t.Run("When version 60 should return v6.0 client", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 60,
					"timeField": "@timestamp",
				}),
			}

			c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.NoError(t, err)
			assert.Equal(t, "6.0.0", c.GetVersion().String())
		})

		t.Run("When version 70 should return v7.0 client", func(t *testing.T) {
			ds := &models.DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"esVersion": 70,
					"timeField": "@timestamp",
				}),
			}

			c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
			require.NoError(t, err)
			assert.Equal(t, "7.0.0", c.GetVersion().String())
		})
	})

	t.Run("When version is a valid semver string should create a client", func(t *testing.T) {
		version := "7.2.4"
		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": version,
				"timeField": "@timestamp",
			}),
		}

		c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
		require.NoError(t, err)
		assert.Equal(t, version, c.GetVersion().String())
	})

	t.Run("When version is NOT a valid semver string should return error", func(t *testing.T) {
		version := "7.NOT_VALID.4"
		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": version,
				"timeField": "@timestamp",
			}),
		}

		_, err := NewClient(context.Background(), httpclient.NewProvider(), ds, plugins.DataTimeRange{})
		require.Error(t, err)
	})
}

func TestClient_ExecuteMultisearch(t *testing.T) {
	httpClientScenario(t, "Given a fake http client and a v2.x client with response", &models.DataSource{
		Database: "[metrics-]YYYY.MM.DD",
		JsonData: simplejson.NewFromAny(map[string]interface{}{
			"esVersion": 2,
			"timeField": "@timestamp",
			"interval":  "Daily",
		}),
	}, func(sc *scenarioContext) {
		sc.responseBody = `{
				"responses": [
					{
						"hits": { "hits": [], "max_score": 0, "total": 4656 },
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
		assert.Equal(t, "count", jHeader.Get("search_type").MustString())
		assert.Empty(t, jHeader.Get("max_concurrent_shard_requests"))

		assert.Equal(t, "15000*@hostname", jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString())

		assert.Equal(t, "15s", jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString())

		assert.Equal(t, 200, res.Status)
		require.Len(t, res.Responses, 1)
	})

	httpClientScenario(t, "Given a fake http client and a v5.x client with response", &models.DataSource{
		Database: "[metrics-]YYYY.MM.DD",
		JsonData: simplejson.NewFromAny(map[string]interface{}{
			"esVersion":                  5,
			"maxConcurrentShardRequests": 100,
			"timeField":                  "@timestamp",
			"interval":                   "Daily",
		}),
	}, func(sc *scenarioContext) {
		sc.responseBody = `{
				"responses": [
					{
						"hits": { "hits": [], "max_score": 0, "total": 4656 },
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

		assert.Equal(t, "15000*@hostname", jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString())

		assert.Equal(t, "15s", jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString())

		assert.Equal(t, 200, res.Status)
		require.Len(t, res.Responses, 1)
	})

	httpClientScenario(t, "Given a fake http client and a v5.6 client with response", &models.DataSource{
		Database: "[metrics-]YYYY.MM.DD",
		JsonData: simplejson.NewFromAny(map[string]interface{}{
			"esVersion":                  "5.6.0",
			"maxConcurrentShardRequests": 100,
			"timeField":                  "@timestamp",
			"interval":                   "Daily",
			"includeFrozen":              true,
			"xpack":                      true,
		}),
	}, func(sc *scenarioContext) {
		sc.responseBody = `{
				"responses": [
					{
						"hits": { "hits": [], "max_score": 0, "total": 4656 },
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
		assert.NotContains(t, sc.request.URL.RawQuery, "ignore_throttled=")

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
		assert.Equal(t, 100, jHeader.Get("max_concurrent_shard_requests").MustInt())

		assert.Equal(t, "15000*@hostname", jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString())

		assert.Equal(t, "15s", jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString())

		assert.Equal(t, 200, res.Status)
		require.Len(t, res.Responses, 1)
	})

	httpClientScenario(t, "Given a fake http client and a v7.0 client with response", &models.DataSource{
		Database: "[metrics-]YYYY.MM.DD",
		JsonData: simplejson.NewFromAny(map[string]interface{}{
			"esVersion":                  "7.0.0",
			"maxConcurrentShardRequests": 6,
			"timeField":                  "@timestamp",
			"interval":                   "Daily",
			"includeFrozen":              true,
			"xpack":                      true,
		}),
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

		assert.Equal(t, "15s", jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString())

		assert.Equal(t, 200, res.Status)
		require.Len(t, res.Responses, 1)
	})
}

func createMultisearchForTest(t *testing.T, c Client) (*MultiSearchRequest, error) {
	t.Helper()

	msb := c.MultiSearch()
	s := msb.Search(interval.Interval{Value: 15 * time.Second, Text: "15s"})
	s.Agg().DateHistogram("2", "@timestamp", func(a *DateHistogramAgg, ab AggBuilder) {
		a.Interval = "$__interval"

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

func httpClientScenario(t *testing.T, desc string, ds *models.DataSource, fn scenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		sc := &scenarioContext{
			responseStatus: 200,
			responseBody:   `{ "responses": [] }`,
		}
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			sc.request = r
			buf, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			sc.requestBody = bytes.NewBuffer(buf)

			rw.Header().Set("Content-Type", "application/x-ndjson")
			_, err = rw.Write([]byte(sc.responseBody))
			require.NoError(t, err)
			rw.WriteHeader(sc.responseStatus)
		}))
		ds.Url = ts.URL

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
		toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
		timeRange := plugins.NewDataTimeRange(fromStr, toStr)

		c, err := NewClient(context.Background(), httpclient.NewProvider(), ds, timeRange)
		require.NoError(t, err)
		require.NotNil(t, c)
		sc.client = c

		currentNewDatasourceHTTPClient := newDatasourceHttpClient

		newDatasourceHttpClient = func(httpClientProvider httpclient.Provider, ds *models.DataSource) (*http.Client, error) {
			return ts.Client(), nil
		}

		t.Cleanup(func() {
			ts.Close()
			newDatasourceHttpClient = currentNewDatasourceHTTPClient
		})

		fn(sc)
	})
}
