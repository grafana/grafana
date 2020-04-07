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
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

//nolint:goconst
func TestClient(t *testing.T) {
	Convey("Test elasticsearch client", t, func() {
		Convey("NewClient", func() {
			Convey("When no version set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(make(map[string]interface{})),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When no time field name set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 5,
					}),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When unsupported version set should return error", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 6,
						"timeField": "@timestamp",
					}),
				}

				_, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldNotBeNil)
			})

			Convey("When version 2 should return v2 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 2,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 2)
			})

			Convey("When version 5 should return v5 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 5,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 5)
			})

			Convey("When version 56 should return v5.6 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 56,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 56)
			})

			Convey("When version 60 should return v6.0 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 60,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 60)
			})

			Convey("When version 70 should return v7.0 client", func() {
				ds := &models.DataSource{
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 70,
						"timeField": "@timestamp",
					}),
				}

				c, err := NewClient(context.Background(), ds, nil)
				So(err, ShouldBeNil)
				So(c.GetVersion(), ShouldEqual, 70)
			})
		})

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
						"hits": {	"hits": [], "max_score": 0,	"total": 4656	},
						"status": 200
					}
				]
			}`

			Convey("When executing multi search", func() {
				ms, err := createMultisearchForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecuteMultisearch(ms)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_msearch")

					So(sc.requestBody, ShouldNotBeNil)

					headerBytes, err := sc.requestBody.ReadBytes('\n')
					So(err, ShouldBeNil)
					bodyBytes := sc.requestBody.Bytes()

					jHeader, err := simplejson.NewJson(headerBytes)
					So(err, ShouldBeNil)

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					So(jHeader.Get("index").MustString(), ShouldEqual, "metrics-2018.05.15")
					So(jHeader.Get("ignore_unavailable").MustBool(false), ShouldEqual, true)
					So(jHeader.Get("search_type").MustString(), ShouldEqual, "count")
					So(jHeader.Get("max_concurrent_shard_requests").MustInt(10), ShouldEqual, 10)

					Convey("and replace $__interval variable", func() {
						So(jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString(), ShouldEqual, "15000*@hostname")
					})

					Convey("and replace $__interval_ms variable", func() {
						So(jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString(), ShouldEqual, "15s")
					})
				})

				Convey("Should parse response", func() {
					So(res.Status, ShouldEqual, 200)
					So(res.Responses, ShouldHaveLength, 1)
				})
			})
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
						"hits": {	"hits": [], "max_score": 0,	"total": 4656	},
						"status": 200
					}
				]
			}`

			Convey("When executing multi search", func() {
				ms, err := createMultisearchForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecuteMultisearch(ms)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_msearch")

					So(sc.requestBody, ShouldNotBeNil)

					headerBytes, err := sc.requestBody.ReadBytes('\n')
					So(err, ShouldBeNil)
					bodyBytes := sc.requestBody.Bytes()

					jHeader, err := simplejson.NewJson(headerBytes)
					So(err, ShouldBeNil)

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					So(jHeader.Get("index").MustString(), ShouldEqual, "metrics-2018.05.15")
					So(jHeader.Get("ignore_unavailable").MustBool(false), ShouldEqual, true)
					So(jHeader.Get("search_type").MustString(), ShouldEqual, "query_then_fetch")
					So(jHeader.Get("max_concurrent_shard_requests").MustInt(10), ShouldEqual, 10)

					Convey("and replace $__interval variable", func() {
						So(jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString(), ShouldEqual, "15000*@hostname")
					})

					Convey("and replace $__interval_ms variable", func() {
						So(jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString(), ShouldEqual, "15s")
					})
				})

				Convey("Should parse response", func() {
					So(res.Status, ShouldEqual, 200)
					So(res.Responses, ShouldHaveLength, 1)
				})
			})
		})

		httpClientScenario(t, "Given a fake http client and a v5.6 client with response", &models.DataSource{
			Database: "[metrics-]YYYY.MM.DD",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion":                  56,
				"maxConcurrentShardRequests": 100,
				"timeField":                  "@timestamp",
				"interval":                   "Daily",
			}),
		}, func(sc *scenarioContext) {
			sc.responseBody = `{
				"responses": [
					{
						"hits": {	"hits": [], "max_score": 0,	"total": 4656	},
						"status": 200
					}
				]
			}`

			Convey("When executing multi search", func() {
				ms, err := createMultisearchForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecuteMultisearch(ms)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_msearch")

					So(sc.requestBody, ShouldNotBeNil)

					headerBytes, err := sc.requestBody.ReadBytes('\n')
					So(err, ShouldBeNil)
					bodyBytes := sc.requestBody.Bytes()

					jHeader, err := simplejson.NewJson(headerBytes)
					So(err, ShouldBeNil)

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					So(jHeader.Get("index").MustString(), ShouldEqual, "metrics-2018.05.15")
					So(jHeader.Get("ignore_unavailable").MustBool(false), ShouldEqual, true)
					So(jHeader.Get("search_type").MustString(), ShouldEqual, "query_then_fetch")
					So(jHeader.Get("max_concurrent_shard_requests").MustInt(), ShouldEqual, 100)

					Convey("and replace $__interval variable", func() {
						So(jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString(), ShouldEqual, "15000*@hostname")
					})

					Convey("and replace $__interval_ms variable", func() {
						So(jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString(), ShouldEqual, "15s")
					})
				})

				Convey("Should parse response", func() {
					So(res.Status, ShouldEqual, 200)
					So(res.Responses, ShouldHaveLength, 1)
				})
			})
		})

		httpClientScenario(t, "Given a fake http client and a v7.0 client with response", &models.DataSource{
			Database: "[metrics-]YYYY.MM.DD",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion":                  70,
				"maxConcurrentShardRequests": 6,
				"timeField":                  "@timestamp",
				"interval":                   "Daily",
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

			Convey("When executing multi search", func() {
				ms, err := createMultisearchForTest(sc.client)
				So(err, ShouldBeNil)
				res, err := sc.client.ExecuteMultisearch(ms)
				So(err, ShouldBeNil)

				Convey("Should send correct request and payload", func() {
					So(sc.request, ShouldNotBeNil)
					So(sc.request.Method, ShouldEqual, http.MethodPost)
					So(sc.request.URL.Path, ShouldEqual, "/_msearch")
					So(sc.request.URL.RawQuery, ShouldEqual, "max_concurrent_shard_requests=6")

					So(sc.requestBody, ShouldNotBeNil)

					headerBytes, err := sc.requestBody.ReadBytes('\n')
					So(err, ShouldBeNil)
					bodyBytes := sc.requestBody.Bytes()

					jHeader, err := simplejson.NewJson(headerBytes)
					So(err, ShouldBeNil)

					jBody, err := simplejson.NewJson(bodyBytes)
					So(err, ShouldBeNil)

					So(jHeader.Get("index").MustString(), ShouldEqual, "metrics-2018.05.15")
					So(jHeader.Get("ignore_unavailable").MustBool(false), ShouldEqual, true)
					So(jHeader.Get("search_type").MustString(), ShouldEqual, "query_then_fetch")

					Convey("and replace $__interval variable", func() {
						So(jBody.GetPath("aggs", "2", "aggs", "1", "avg", "script").MustString(), ShouldEqual, "15000*@hostname")
					})

					Convey("and replace $__interval_ms variable", func() {
						So(jBody.GetPath("aggs", "2", "date_histogram", "interval").MustString(), ShouldEqual, "15s")
					})
				})

				Convey("Should parse response", func() {
					So(res.Status, ShouldEqual, 200)
					So(res.Responses, ShouldHaveLength, 1)
				})
			})
		})
	})
}

func createMultisearchForTest(c Client) (*MultiSearchRequest, error) {
	msb := c.MultiSearch()
	s := msb.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
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

	Convey(desc, func() {
		sc := &scenarioContext{
			responseStatus: 200,
			responseBody:   `{ "responses": [] }`,
		}
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			sc.request = r
			buf, err := ioutil.ReadAll(r.Body)
			require.Nil(t, err)

			sc.requestBody = bytes.NewBuffer(buf)

			rw.Header().Add("Content-Type", "application/json")
			_, err = rw.Write([]byte(sc.responseBody))
			require.Nil(t, err)
			rw.WriteHeader(sc.responseStatus)
		}))
		ds.Url = ts.URL

		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
		toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
		timeRange := tsdb.NewTimeRange(fromStr, toStr)

		c, err := NewClient(context.Background(), ds, timeRange)
		So(err, ShouldBeNil)
		So(c, ShouldNotBeNil)
		sc.client = c

		currentNewDatasourceHttpClient := newDatasourceHttpClient

		newDatasourceHttpClient = func(ds *models.DataSource) (*http.Client, error) {
			return ts.Client(), nil
		}

		defer func() {
			ts.Close()
			newDatasourceHttpClient = currentNewDatasourceHttpClient
		}()

		fn(sc)
	})
}
