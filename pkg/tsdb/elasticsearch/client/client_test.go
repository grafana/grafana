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

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

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
		})

		Convey("Given a fake http client", func() {
			var responseBuffer *bytes.Buffer
			var req *http.Request
			ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				req = r
				buf, err := ioutil.ReadAll(r.Body)
				if err != nil {
					t.Fatalf("Failed to read response body, err=%v", err)
				}
				responseBuffer = bytes.NewBuffer(buf)
			}))

			currentNewDatasourceHttpClient := newDatasourceHttpClient

			newDatasourceHttpClient = func(ds *models.DataSource) (*http.Client, error) {
				return ts.Client(), nil
			}

			from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
			to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
			fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
			toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
			timeRange := tsdb.NewTimeRange(fromStr, toStr)

			Convey("and a v2.x client", func() {
				ds := models.DataSource{
					Database: "[metrics-]YYYY.MM.DD",
					Url:      ts.URL,
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion": 2,
						"timeField": "@timestamp",
						"interval":  "Daily",
					}),
				}

				c, err := NewClient(context.Background(), &ds, timeRange)
				So(err, ShouldBeNil)
				So(c, ShouldNotBeNil)

				Convey("When executing multi search", func() {
					ms, err := createMultisearchForTest(c)
					So(err, ShouldBeNil)
					c.ExecuteMultisearch(ms)

					Convey("Should send correct request and payload", func() {
						So(req, ShouldNotBeNil)
						So(req.Method, ShouldEqual, http.MethodPost)
						So(req.URL.Path, ShouldEqual, "/_msearch")

						So(responseBuffer, ShouldNotBeNil)

						headerBytes, err := responseBuffer.ReadBytes('\n')
						So(err, ShouldBeNil)
						bodyBytes := responseBuffer.Bytes()

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
				})
			})

			Convey("and a v5.x client", func() {
				ds := models.DataSource{
					Database: "[metrics-]YYYY.MM.DD",
					Url:      ts.URL,
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion":                  5,
						"maxConcurrentShardRequests": 100,
						"timeField":                  "@timestamp",
						"interval":                   "Daily",
					}),
				}

				c, err := NewClient(context.Background(), &ds, timeRange)
				So(err, ShouldBeNil)
				So(c, ShouldNotBeNil)

				Convey("When executing multi search", func() {
					ms, err := createMultisearchForTest(c)
					So(err, ShouldBeNil)
					c.ExecuteMultisearch(ms)

					Convey("Should send correct request and payload", func() {
						So(req, ShouldNotBeNil)
						So(req.Method, ShouldEqual, http.MethodPost)
						So(req.URL.Path, ShouldEqual, "/_msearch")

						So(responseBuffer, ShouldNotBeNil)

						headerBytes, err := responseBuffer.ReadBytes('\n')
						So(err, ShouldBeNil)
						bodyBytes := responseBuffer.Bytes()

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
				})
			})

			Convey("and a v5.6 client", func() {
				ds := models.DataSource{
					Database: "[metrics-]YYYY.MM.DD",
					Url:      ts.URL,
					JsonData: simplejson.NewFromAny(map[string]interface{}{
						"esVersion":                  56,
						"maxConcurrentShardRequests": 100,
						"timeField":                  "@timestamp",
						"interval":                   "Daily",
					}),
				}

				c, err := NewClient(context.Background(), &ds, timeRange)
				So(err, ShouldBeNil)
				So(c, ShouldNotBeNil)

				Convey("When executing multi search", func() {
					ms, err := createMultisearchForTest(c)
					So(err, ShouldBeNil)
					c.ExecuteMultisearch(ms)

					Convey("Should send correct request and payload", func() {
						So(req, ShouldNotBeNil)
						So(req.Method, ShouldEqual, http.MethodPost)
						So(req.URL.Path, ShouldEqual, "/_msearch")

						So(responseBuffer, ShouldNotBeNil)

						headerBytes, err := responseBuffer.ReadBytes('\n')
						So(err, ShouldBeNil)
						bodyBytes := responseBuffer.Bytes()

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
				})
			})

			Reset(func() {
				newDatasourceHttpClient = currentNewDatasourceHttpClient
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
