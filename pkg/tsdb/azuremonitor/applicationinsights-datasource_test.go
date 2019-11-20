package azuremonitor

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestApplicationInsightsDatasource(t *testing.T) {
	Convey("ApplicationInsightsDatasource", t, func() {
		datasource := &ApplicationInsightsDatasource{}

		Convey("Parse queries from frontend and build AzureMonitor API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						DataSource: &models.DataSource{
							JsonData: simplejson.NewFromAny(map[string]interface{}{}),
						},
						Model: simplejson.NewFromAny(map[string]interface{}{
							"appInsights": map[string]interface{}{
								"rawQuery":    false,
								"timeGrain":   "PT1M",
								"aggregation": "Average",
								"metricName":  "server/exceptions",
								"alias":       "testalias",
								"queryType":   "Application Insights",
							},
						}),
						RefId:      "A",
						IntervalMs: 1234,
					},
				},
			}
			Convey("and is a normal query", func() {
				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].ApiURL, ShouldEqual, "metrics/server/exceptions")
				So(queries[0].Target, ShouldEqual, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(len(queries[0].Params), ShouldEqual, 3)
				So(queries[0].Params["timespan"][0], ShouldEqual, "2018-03-15T13:00:00Z/2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation"][0], ShouldEqual, "Average")
				So(queries[0].Params["interval"][0], ShouldEqual, "PT1M")
				So(queries[0].Alias, ShouldEqual, "testalias")
			})

			Convey("and has a time grain set to auto", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"appInsights": map[string]interface{}{
						"rawQuery":    false,
						"timeGrain":   "auto",
						"aggregation": "Average",
						"metricName":  "Percentage CPU",
						"alias":       "testalias",
						"queryType":   "Application Insights",
					},
				})
				tsdbQuery.Queries[0].IntervalMs = 400000

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT15M")
			})

			Convey("and has a time grain set to auto and the metric has a limited list of allowed time grains", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"appInsights": map[string]interface{}{
						"rawQuery":            false,
						"timeGrain":           "auto",
						"aggregation":         "Average",
						"metricName":          "Percentage CPU",
						"alias":               "testalias",
						"queryType":           "Application Insights",
						"allowedTimeGrainsMs": []interface{}{"auto", json.Number("60000"), json.Number("300000")},
					},
				})
				tsdbQuery.Queries[0].IntervalMs = 400000

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Params["interval"][0], ShouldEqual, "PT5M")
			})

			Convey("and has a dimension filter", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"appInsights": map[string]interface{}{
						"rawQuery":        false,
						"timeGrain":       "PT1M",
						"aggregation":     "Average",
						"metricName":      "Percentage CPU",
						"alias":           "testalias",
						"queryType":       "Application Insights",
						"dimension":       "blob",
						"dimensionFilter": "blob eq '*'",
					},
				})

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Target, ShouldEqual, "aggregation=Average&filter=blob+eq+%27%2A%27&interval=PT1M&segment=blob&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
				So(queries[0].Params["filter"][0], ShouldEqual, "blob eq '*'")

			})

			Convey("and has a dimension filter set to None", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"appInsights": map[string]interface{}{
						"rawQuery":    false,
						"timeGrain":   "PT1M",
						"aggregation": "Average",
						"metricName":  "Percentage CPU",
						"alias":       "testalias",
						"queryType":   "Application Insights",
						"dimension":   "None",
					},
				})

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)

				So(queries[0].Target, ShouldEqual, "aggregation=Average&interval=PT1M&timespan=2018-03-15T13%3A00%3A00Z%2F2018-03-15T13%3A34%3A00Z")
			})

			Convey("id a raw query", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"appInsights": map[string]interface{}{
						"rawQuery":       true,
						"rawQueryString": "exceptions | where $__timeFilter(timestamp) | summarize count=count() by bin(timestamp, $__interval)",
						"timeColumn":     "timestamp",
						"valueColumn":    "count",
					},
				})

				queries, err := datasource.buildQueries(tsdbQuery.Queries, tsdbQuery.TimeRange)
				So(err, ShouldBeNil)
				So(queries[0].Params["query"][0], ShouldEqual, "exceptions | where ['timestamp'] >= datetime('2018-03-15T13:00:00Z') and ['timestamp'] <= datetime('2018-03-15T13:34:00Z') | summarize count=count() by bin(timestamp, 1234ms)")
				So(queries[0].Target, ShouldEqual, "query=exceptions+%7C+where+%5B%27timestamp%27%5D+%3E%3D+datetime%28%272018-03-15T13%3A00%3A00Z%27%29+and+%5B%27timestamp%27%5D+%3C%3D+datetime%28%272018-03-15T13%3A34%3A00Z%27%29+%7C+summarize+count%3Dcount%28%29+by+bin%28timestamp%2C+1234ms%29")
			})
		})

		Convey("Parse Application Insights query API response in the time series format", func() {
			Convey("no segments", func() {
				data, err := ioutil.ReadFile("./test-data/applicationinsights/1-application-insights-response-raw-query.json")
				So(err, ShouldBeNil)

				query := &ApplicationInsightsQuery{
					IsRaw:           true,
					TimeColumnName:  "timestamp",
					ValueColumnName: "value",
				}
				series, _, err := datasource.parseTimeSeriesFromQuery(data, query)
				So(err, ShouldBeNil)

				So(len(series), ShouldEqual, 1)
				So(series[0].Name, ShouldEqual, "value")
				So(len(series[0].Points), ShouldEqual, 2)

				So(series[0].Points[0][0].Float64, ShouldEqual, 1)
				So(series[0].Points[0][1].Float64, ShouldEqual, int64(1568336523000))

				So(series[0].Points[1][0].Float64, ShouldEqual, 2)
				So(series[0].Points[1][1].Float64, ShouldEqual, int64(1568340123000))
			})

			Convey("with segments", func() {
				data, err := ioutil.ReadFile("./test-data/applicationinsights/2-application-insights-response-raw-query-segmented.json")
				So(err, ShouldBeNil)

				query := &ApplicationInsightsQuery{
					IsRaw:             true,
					TimeColumnName:    "timestamp",
					ValueColumnName:   "value",
					SegmentColumnName: "segment",
				}
				series, _, err := datasource.parseTimeSeriesFromQuery(data, query)
				So(err, ShouldBeNil)

				So(len(series), ShouldEqual, 2)
				So(series[0].Name, ShouldEqual, "{segment=a}.value")
				So(len(series[0].Points), ShouldEqual, 2)

				So(series[0].Points[0][0].Float64, ShouldEqual, 1)
				So(series[0].Points[0][1].Float64, ShouldEqual, int64(1568336523000))

				So(series[0].Points[1][0].Float64, ShouldEqual, 3)
				So(series[0].Points[1][1].Float64, ShouldEqual, int64(1568426523000))

				So(series[1].Name, ShouldEqual, "{segment=b}.value")
				So(series[1].Points[0][0].Float64, ShouldEqual, 2)
				So(series[1].Points[0][1].Float64, ShouldEqual, int64(1568336523000))

				So(series[1].Points[1][0].Float64, ShouldEqual, 4)
				So(series[1].Points[1][1].Float64, ShouldEqual, int64(1568426523000))

				Convey("with alias", func() {
					data, err := ioutil.ReadFile("./test-data/applicationinsights/2-application-insights-response-raw-query-segmented.json")
					So(err, ShouldBeNil)

					query := &ApplicationInsightsQuery{
						IsRaw:             true,
						TimeColumnName:    "timestamp",
						ValueColumnName:   "value",
						SegmentColumnName: "segment",
						Alias:             "{{metric}} {{dimensionname}} {{dimensionvalue}}",
					}
					series, _, err := datasource.parseTimeSeriesFromQuery(data, query)
					So(err, ShouldBeNil)

					So(len(series), ShouldEqual, 2)
					So(series[0].Name, ShouldEqual, "value segment a")
					So(series[1].Name, ShouldEqual, "value segment b")

				})
			})
		})

		Convey("Parse Application Insights metrics API", func() {
			Convey("single value", func() {
				data, err := ioutil.ReadFile("./test-data/applicationinsights/3-application-insights-response-metrics-single-value.json")
				So(err, ShouldBeNil)
				query := &ApplicationInsightsQuery{
					IsRaw: false,
				}
				series, err := datasource.parseTimeSeriesFromMetrics(data, query)
				So(err, ShouldBeNil)

				So(len(series), ShouldEqual, 1)
				So(series[0].Name, ShouldEqual, "value")
				So(len(series[0].Points), ShouldEqual, 1)

				So(series[0].Points[0][0].Float64, ShouldEqual, 1.2)
				So(series[0].Points[0][1].Float64, ShouldEqual, int64(1568340123000))
			})

			Convey("1H separation", func() {
				data, err := ioutil.ReadFile("./test-data/applicationinsights/4-application-insights-response-metrics-no-segment.json")
				So(err, ShouldBeNil)
				query := &ApplicationInsightsQuery{
					IsRaw: false,
				}
				series, err := datasource.parseTimeSeriesFromMetrics(data, query)
				So(err, ShouldBeNil)

				So(len(series), ShouldEqual, 1)
				So(series[0].Name, ShouldEqual, "value")
				So(len(series[0].Points), ShouldEqual, 2)

				So(series[0].Points[0][0].Float64, ShouldEqual, 1)
				So(series[0].Points[0][1].Float64, ShouldEqual, int64(1568340123000))
				So(series[0].Points[1][0].Float64, ShouldEqual, 2)
				So(series[0].Points[1][1].Float64, ShouldEqual, int64(1568343723000))

				Convey("with segmentation", func() {
					data, err := ioutil.ReadFile("./test-data/applicationinsights/4-application-insights-response-metrics-segmented.json")
					So(err, ShouldBeNil)
					query := &ApplicationInsightsQuery{
						IsRaw: false,
					}
					series, err := datasource.parseTimeSeriesFromMetrics(data, query)
					So(err, ShouldBeNil)

					So(len(series), ShouldEqual, 2)
					So(series[0].Name, ShouldEqual, "{blob=a}.value")
					So(len(series[0].Points), ShouldEqual, 2)

					So(series[0].Points[0][0].Float64, ShouldEqual, 1)
					So(series[0].Points[0][1].Float64, ShouldEqual, int64(1568340123000))
					So(series[0].Points[1][0].Float64, ShouldEqual, 2)
					So(series[0].Points[1][1].Float64, ShouldEqual, int64(1568343723000))

					So(series[1].Name, ShouldEqual, "{blob=b}.value")
					So(len(series[1].Points), ShouldEqual, 2)

					So(series[1].Points[0][0].Float64, ShouldEqual, 3)
					So(series[1].Points[0][1].Float64, ShouldEqual, int64(1568340123000))
					So(series[1].Points[1][0].Float64, ShouldEqual, 4)
					So(series[1].Points[1][1].Float64, ShouldEqual, int64(1568343723000))

					Convey("with alias", func() {
						data, err := ioutil.ReadFile("./test-data/applicationinsights/4-application-insights-response-metrics-segmented.json")
						So(err, ShouldBeNil)
						query := &ApplicationInsightsQuery{
							IsRaw: false,
							Alias: "{{metric}} {{dimensionname}} {{dimensionvalue}}",
						}
						series, err := datasource.parseTimeSeriesFromMetrics(data, query)
						So(err, ShouldBeNil)

						So(len(series), ShouldEqual, 2)
						So(series[0].Name, ShouldEqual, "value blob a")
						So(series[1].Name, ShouldEqual, "value blob b")
					})
				})
			})
		})
	})
}
