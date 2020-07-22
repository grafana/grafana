package cloudmonitoring

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"net/url"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudMonitoring(t *testing.T) {
	Convey("Google Cloud Monitoring", t, func() {
		executor := &CloudMonitoringExecutor{}

		Convey("Parse migrated queries from frontend and build Google Cloud Monitoring API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"metricType": "a/metric/type",
							"view":       "FULL",
							"aliasBy":    "testalias",
							"type":       "timeSeriesQuery",
						}),
						RefId: "A",
					},
				},
			}

			Convey("and query has no aggregation set", func() {
				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_NONE&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 7)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
				So(queries[0].AliasBy, ShouldEqual, "testalias")

				Convey("and generated deep link has correct parameters", func() {
					dl := queries[0].buildDeepLink()
					So(dl, ShouldBeEmpty) // no resource type found

					// assign resource type to query parameters to be included in the deep link filter
					// in the actual workflow this information comes from the response of the Monitoring API
					queries[0].Params.Set("resourceType", "a/resource/type")
					dl = queries[0].buildDeepLink()

					expectedTimeSelection := map[string]string{
						"timeRange": "custom",
						"start":     "2018-03-15T13:00:00Z",
						"end":       "2018-03-15T13:34:00Z",
					}
					expectedTimeSeriesFilter := map[string]interface{}{
						"perSeriesAligner": "ALIGN_MEAN",
						"filter":           "resource.type=\"a/resource/type\" metric.type=\"a/metric/type\"",
					}
					verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
				})
			})

			Convey("and query has filters", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType": "a/metric/type",
					"filters":    []interface{}{"key", "=", "value", "AND", "key2", "=", "value2", "AND", "resource.type", "=", "another/resource/type"},
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)
				So(len(queries), ShouldEqual, 1)
				So(queries[0].Params["filter"][0], ShouldEqual, `metric.type="a/metric/type" key="value" key2="value2" resource.type="another/resource/type"`)

				Convey("and generated deep link has correct parameters", func() {
					// assign a resource type to query parameters
					// in the actual workflow this information comes from the response of the Monitoring API
					// the deep link should not contain this resource type since another resource type is included in the query filters
					queries[0].Params.Set("resourceType", "a/resource/type")
					dl := queries[0].buildDeepLink()

					expectedTimeSelection := map[string]string{
						"timeRange": "custom",
						"start":     "2018-03-15T13:00:00Z",
						"end":       "2018-03-15T13:34:00Z",
					}
					expectedTimeSeriesFilter := map[string]interface{}{
						"filter": `metric.type="a/metric/type" key="value" key2="value2" resource.type="another/resource/type"`,
					}
					verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
				})
			})

			Convey("and alignmentPeriod is set to grafana-auto", func() {
				Convey("and IntervalMs is larger than 60000", func() {
					tsdbQuery.Queries[0].IntervalMs = 1000000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "grafana-auto",
						"filters":         []interface{}{"key", "=", "value", "AND", "key2", "=", "value2"},
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+1000s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-03-15T13:00:00Z",
							"end":       "2018-03-15T13:34:00Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `1000s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})
				Convey("and IntervalMs is less than 60000", func() {
					tsdbQuery.Queries[0].IntervalMs = 30000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "grafana-auto",
						"filters":         []interface{}{"key", "=", "value", "AND", "key2", "=", "value2"},
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-03-15T13:00:00Z",
							"end":       "2018-03-15T13:34:00Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `60s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})
			})

			Convey("and alignmentPeriod is set to cloud-monitoring-auto", func() { // legacy
				Convey("and range is two hours", func() {
					tsdbQuery.TimeRange.From = "1538033322461"
					tsdbQuery.TimeRange.To = "1538040522461"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "cloud-monitoring-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				})

				Convey("and range is 22 hours", func() {
					tsdbQuery.TimeRange.From = "1538034524922"
					tsdbQuery.TimeRange.To = "1538113724922"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "cloud-monitoring-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				})

				Convey("and range is 23 hours", func() {
					tsdbQuery.TimeRange.From = "1538034567985"
					tsdbQuery.TimeRange.To = "1538117367985"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "cloud-monitoring-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+300s`)
				})

				Convey("and range is 7 days", func() {
					tsdbQuery.TimeRange.From = "1538036324073"
					tsdbQuery.TimeRange.To = "1538641124073"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "cloud-monitoring-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+3600s`)
				})
			})

			Convey("and alignmentPeriod is set to stackdriver-auto", func() { // legacy
				Convey("and range is two hours", func() {
					tsdbQuery.TimeRange.From = "1538033322461"
					tsdbQuery.TimeRange.To = "1538040522461"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-09-27T07:28:42Z",
							"end":       "2018-09-27T09:28:42Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `60s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})

				Convey("and range is 22 hours", func() {
					tsdbQuery.TimeRange.From = "1538034524922"
					tsdbQuery.TimeRange.To = "1538113724922"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-09-27T07:48:44Z",
							"end":       "2018-09-28T05:48:44Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `60s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})

				Convey("and range is 23 hours", func() {
					tsdbQuery.TimeRange.From = "1538034567985"
					tsdbQuery.TimeRange.To = "1538117367985"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+300s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-09-27T07:49:27Z",
							"end":       "2018-09-28T06:49:27Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `300s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})

				Convey("and range is 7 days", func() {
					tsdbQuery.TimeRange.From = "1538036324073"
					tsdbQuery.TimeRange.To = "1538641124073"
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"target":          "target",
						"alignmentPeriod": "stackdriver-auto",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+3600s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-09-27T08:18:44Z",
							"end":       "2018-10-04T08:18:44Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `3600s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})
			})

			Convey("and alignmentPeriod is set in frontend", func() {
				Convey("and alignment period is within accepted range", func() {
					tsdbQuery.Queries[0].IntervalMs = 1000
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"alignmentPeriod": "+600s",
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+600s`)

					Convey("and generated deep link has correct parameters", func() {
						// assign resource type to query parameters to be included in the deep link filter
						// in the actual workflow this information comes from the response of the Monitoring API
						queries[0].Params.Set("resourceType", "a/resource/type")
						dl := queries[0].buildDeepLink()

						expectedTimeSelection := map[string]string{
							"timeRange": "custom",
							"start":     "2018-03-15T13:00:00Z",
							"end":       "2018-03-15T13:34:00Z",
						}
						expectedTimeSeriesFilter := map[string]interface{}{
							"minAlignmentPeriod": `600s`,
						}
						verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
					})
				})
			})

			Convey("and query has aggregation mean set", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType":         "a/metric/type",
					"crossSeriesReducer": "REDUCE_SUM",
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_SUM&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 7)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.crossSeriesReducer"][0], ShouldEqual, "REDUCE_SUM")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, "+60s")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")

				Convey("and generated deep link has correct parameters", func() {
					// assign resource type to query parameters to be included in the deep link filter
					// in the actual workflow this information comes from the response of the Monitoring API
					queries[0].Params.Set("resourceType", "a/resource/type")
					dl := queries[0].buildDeepLink()

					expectedTimeSelection := map[string]string{
						"timeRange": "custom",
						"start":     "2018-03-15T13:00:00Z",
						"end":       "2018-03-15T13:34:00Z",
					}
					expectedTimeSeriesFilter := map[string]interface{}{
						"minAlignmentPeriod": `60s`,
						"crossSeriesReducer": "REDUCE_SUM",
						"perSeriesAligner":   "ALIGN_MEAN",
						"filter":             "resource.type=\"a/resource/type\" metric.type=\"a/metric/type\"",
					}
					verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
				})
			})

			Convey("and query has group bys", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"metricType":         "a/metric/type",
					"crossSeriesReducer": "REDUCE_NONE",
					"groupBys":           []interface{}{"metric.label.group1", "metric.label.group2"},
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_NONE&aggregation.groupByFields=metric.label.group1&aggregation.groupByFields=metric.label.group2&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 8)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["aggregation.groupByFields"][0], ShouldEqual, "metric.label.group1")
				So(queries[0].Params["aggregation.groupByFields"][1], ShouldEqual, "metric.label.group2")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")

				Convey("and generated deep link has correct parameters", func() {
					// assign resource type to query parameters to be included in the deep link filter
					// in the actual workflow this information comes from the response of the Monitoring API
					queries[0].Params.Set("resourceType", "a/resource/type")
					dl := queries[0].buildDeepLink()

					expectedTimeSelection := map[string]string{
						"timeRange": "custom",
						"start":     "2018-03-15T13:00:00Z",
						"end":       "2018-03-15T13:34:00Z",
					}
					expectedTimeSeriesFilter := map[string]interface{}{
						"minAlignmentPeriod": `60s`,
						"perSeriesAligner":   "ALIGN_MEAN",
						"filter":             "resource.type=\"a/resource/type\" metric.type=\"a/metric/type\"",
						"groupByFields":      []interface{}{"metric.label.group1", "metric.label.group2"},
					}
					verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
				})
			})
		})

		Convey("Parse queries from frontend and build Google Cloud Monitoring API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"queryType": metricQueryType,
							"metricQuery": map[string]interface{}{
								"metricType": "a/metric/type",
								"view":       "FULL",
								"aliasBy":    "testalias",
								"type":       "timeSeriesQuery",
								"groupBys":   []interface{}{"metric.label.group1", "metric.label.group2"},
							},
						}),
						RefId: "A",
					},
				},
			}

			Convey("and query type is metrics", func() {
				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "aggregation.alignmentPeriod=%2B60s&aggregation.crossSeriesReducer=REDUCE_NONE&aggregation.groupByFields=metric.label.group1&aggregation.groupByFields=metric.label.group2&aggregation.perSeriesAligner=ALIGN_MEAN&filter=metric.type%3D%22a%2Fmetric%2Ftype%22&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z&view=FULL")
				So(len(queries[0].Params), ShouldEqual, 8)
				So(queries[0].Params["aggregation.groupByFields"][0], ShouldEqual, "metric.label.group1")
				So(queries[0].Params["aggregation.groupByFields"][1], ShouldEqual, "metric.label.group2")
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
				So(queries[0].AliasBy, ShouldEqual, "testalias")
				So(queries[0].GroupBys, ShouldResemble, []string{"metric.label.group1", "metric.label.group2"})

				Convey("and generated deep link has correct parameters", func() {
					// assign resource type to query parameters to be included in the deep link filter
					// in the actual workflow this information comes from the response of the Monitoring API
					queries[0].Params.Set("resourceType", "a/resource/type")
					dl := queries[0].buildDeepLink()

					expectedTimeSelection := map[string]string{
						"timeRange": "custom",
						"start":     "2018-03-15T13:00:00Z",
						"end":       "2018-03-15T13:34:00Z",
					}
					expectedTimeSeriesFilter := map[string]interface{}{
						"minAlignmentPeriod": `60s`,
						"perSeriesAligner":   "ALIGN_MEAN",
						"filter":             "resource.type=\"a/resource/type\" metric.type=\"a/metric/type\"",
						"groupByFields":      []interface{}{"metric.label.group1", "metric.label.group2"},
					}
					verifyDeepLink(dl, expectedTimeSelection, expectedTimeSeriesFilter)
				})
			})

			Convey("and query type is SLOs", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"queryType":   sloQueryType,
					"metricQuery": map[string]interface{}{},
					"sloQuery": map[string]interface{}{
						"projectName":      "test-proj",
						"alignmentPeriod":  "stackdriver-auto",
						"perSeriesAligner": "ALIGN_NEXT_OLDER",
						"aliasBy":          "",
						"selectorName":     "select_slo_health",
						"serviceId":        "test-service",
						"sloId":            "test-slo",
					},
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, `+60s`)
				So(queries[0].AliasBy, ShouldEqual, "")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Target, ShouldEqual, `aggregation.alignmentPeriod=%2B60s&aggregation.perSeriesAligner=ALIGN_MEAN&filter=select_slo_health%28%22projects%2Ftest-proj%2Fservices%2Ftest-service%2FserviceLevelObjectives%2Ftest-slo%22%29&interval.endTime=2018-03-15T13%3A34%3A00Z&interval.startTime=2018-03-15T13%3A00%3A00Z`)
				So(len(queries[0].Params), ShouldEqual, 5)

				Convey("and perSeriesAligner is inferred by SLO selector", func() {
					tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
						"queryType":   sloQueryType,
						"metricQuery": map[string]interface{}{},
						"sloQuery": map[string]interface{}{
							"projectName":      "test-proj",
							"alignmentPeriod":  "stackdriver-auto",
							"perSeriesAligner": "ALIGN_NEXT_OLDER",
							"aliasBy":          "",
							"selectorName":     "select_slo_compliance",
							"serviceId":        "test-service",
							"sloId":            "test-slo",
						},
					})

					queries, err := executor.buildQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_NEXT_OLDER")

					Convey("and empty deep link", func() {
						dl := queries[0].buildDeepLink()
						So(dl, ShouldBeEmpty)
					})
				})
			})
		})

		Convey("Parse cloud monitoring response in the time series format", func() {
			Convey("when data from query aggregated to one time series", func() {
				data, err := loadTestFile("./test-data/1-series-response-agg-one-metric.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 1)
				So(res.Series[0].Name, ShouldEqual, "serviceruntime.googleapis.com/api/request_count")
				So(len(res.Series[0].Points), ShouldEqual, 3)

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 0.05)
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1536670020000))

					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 1.05)
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, int64(1536670080000))

					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 1.0666666666667)
					So(res.Series[0].Points[2][1].Float64, ShouldEqual, int64(1536670260000))
				})
			})

			Convey("when data from query with no aggregation", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				Convey("Should add labels to metric name", func() {
					So(len(res.Series), ShouldEqual, 3)
					So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1")
					So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1")
					So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1")
				})

				Convey("Should parse to time series", func() {
					So(len(res.Series[0].Points), ShouldEqual, 3)
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 9.8566497180145)
					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 9.7323568146676)
					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 9.7730520330369)
				})

				Convey("Should add meta for labels to the response", func() {
					labels := res.Meta.Get("labels").Interface().(map[string][]string)
					So(labels, ShouldNotBeNil)
					So(len(labels["metric.label.instance_name"]), ShouldEqual, 3)
					So(labels["metric.label.instance_name"], ShouldContain, "collector-asia-east-1")
					So(labels["metric.label.instance_name"], ShouldContain, "collector-europe-west-1")
					So(labels["metric.label.instance_name"], ShouldContain, "collector-us-east-1")

					So(len(labels["resource.label.zone"]), ShouldEqual, 3)
					So(labels["resource.label.zone"], ShouldContain, "asia-east1-a")
					So(labels["resource.label.zone"], ShouldContain, "europe-west1-b")
					So(labels["resource.label.zone"], ShouldContain, "us-east1-b")

					So(len(labels["resource.label.project_id"]), ShouldEqual, 1)
					So(labels["resource.label.project_id"][0], ShouldEqual, "grafana-prod")
				})
			})

			Convey("when data from query with no aggregation and group bys", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				Convey("Should add instance name and zone labels to metric name", func() {
					So(len(res.Series), ShouldEqual, 3)
					So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1 asia-east1-a")
					So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1 europe-west1-b")
					So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1 us-east1-b")
				})
			})

			Convey("when data from query with no aggregation and alias by", func() {
				data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}

				Convey("and the alias pattern is for metric type, a metric label and a resource label", func() {
					query := &cloudMonitoringQuery{AliasBy: "{{metric.type}} - {{metric.label.instance_name}} - {{resource.label.zone}}", GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)

					Convey("Should use alias by formatting and only show instance name", func() {
						So(len(res.Series), ShouldEqual, 3)
						So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-asia-east-1 - asia-east1-a")
						So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-europe-west-1 - europe-west1-b")
						So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time - collector-us-east-1 - us-east1-b")
					})
				})

				Convey("and the alias pattern is for metric name", func() {
					query := &cloudMonitoringQuery{AliasBy: "metric {{metric.name}} service {{metric.service}}", GroupBys: []string{"metric.label.instance_name", "resource.label.zone"}}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)

					Convey("Should use alias by formatting and only show instance name", func() {
						So(len(res.Series), ShouldEqual, 3)
						So(res.Series[0].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
						So(res.Series[1].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
						So(res.Series[2].Name, ShouldEqual, "metric instance/cpu/usage_time service compute")
					})
				})
			})

			Convey("when data from query is distribution with exponential bounds", func() {
				data, err := loadTestFile("./test-data/3-series-response-distribution-exponential.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{AliasBy: "{{bucket}}"}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 11)
				for i := 0; i < 11; i++ {
					if i == 0 {
						So(res.Series[i].Name, ShouldEqual, "0")
					} else {
						So(res.Series[i].Name, ShouldEqual, strconv.FormatInt(int64(math.Pow(float64(2), float64(i-1))), 10))
					}
					So(len(res.Series[i].Points), ShouldEqual, 3)
				}

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1536668940000))
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, int64(1536669000000))
					So(res.Series[0].Points[2][1].Float64, ShouldEqual, int64(1536669060000))
				})

				Convey("bucket bounds should be correct", func() {
					So(res.Series[0].Name, ShouldEqual, "0")
					So(res.Series[1].Name, ShouldEqual, "1")
					So(res.Series[2].Name, ShouldEqual, "2")
					So(res.Series[3].Name, ShouldEqual, "4")
					So(res.Series[4].Name, ShouldEqual, "8")
				})

				Convey("value should be correct", func() {
					So(res.Series[8].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[9].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[10].Points[0][0].Float64, ShouldEqual, 1)
					So(res.Series[8].Points[1][0].Float64, ShouldEqual, 0)
					So(res.Series[9].Points[1][0].Float64, ShouldEqual, 0)
					So(res.Series[10].Points[1][0].Float64, ShouldEqual, 1)
					So(res.Series[8].Points[2][0].Float64, ShouldEqual, 0)
					So(res.Series[9].Points[2][0].Float64, ShouldEqual, 1)
					So(res.Series[10].Points[2][0].Float64, ShouldEqual, 0)
				})
			})

			Convey("when data from query is distribution with explicit bounds", func() {
				data, err := loadTestFile("./test-data/4-series-response-distribution-explicit.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{AliasBy: "{{bucket}}"}
				err = executor.parseResponse(res, data, query)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 33)
				for i := 0; i < 33; i++ {
					if i == 0 {
						So(res.Series[i].Name, ShouldEqual, "0")
					}
					So(len(res.Series[i].Points), ShouldEqual, 2)
				}

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, int64(1550859086000))
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, int64(1550859146000))
				})

				Convey("bucket bounds should be correct", func() {
					So(res.Series[0].Name, ShouldEqual, "0")
					So(res.Series[1].Name, ShouldEqual, "0.01")
					So(res.Series[2].Name, ShouldEqual, "0.05")
					So(res.Series[3].Name, ShouldEqual, "0.1")
				})

				Convey("value should be correct", func() {
					So(res.Series[8].Points[0][0].Float64, ShouldEqual, 381)
					So(res.Series[9].Points[0][0].Float64, ShouldEqual, 212)
					So(res.Series[10].Points[0][0].Float64, ShouldEqual, 56)
					So(res.Series[8].Points[1][0].Float64, ShouldEqual, 375)
					So(res.Series[9].Points[1][0].Float64, ShouldEqual, 213)
					So(res.Series[10].Points[1][0].Float64, ShouldEqual, 56)
				})
			})

			Convey("when data from query returns metadata system labels", func() {
				data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				query := &cloudMonitoringQuery{AliasBy: "{{bucket}}"}
				err = executor.parseResponse(res, data, query)
				labels := res.Meta.Get("labels").Interface().(map[string][]string)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 3)

				Convey("and systemlabel contains key with array of string", func() {
					So(len(labels["metadata.system_labels.test"]), ShouldEqual, 5)
					So(labels["metadata.system_labels.test"], ShouldContain, "value1")
					So(labels["metadata.system_labels.test"], ShouldContain, "value2")
					So(labels["metadata.system_labels.test"], ShouldContain, "value3")
					So(labels["metadata.system_labels.test"], ShouldContain, "value4")
					So(labels["metadata.system_labels.test"], ShouldContain, "value5")
				})

				Convey("and systemlabel contains key with primitive strings", func() {
					So(len(labels["metadata.system_labels.region"]), ShouldEqual, 2)
					So(labels["metadata.system_labels.region"], ShouldContain, "us-central1")
					So(labels["metadata.system_labels.region"], ShouldContain, "us-west1")
				})

				Convey("and userLabel contains key with primitive strings", func() {
					So(len(labels["metadata.user_labels.region"]), ShouldEqual, 2)
					So(labels["metadata.user_labels.region"], ShouldContain, "region1")
					So(labels["metadata.user_labels.region"], ShouldContain, "region3")

					So(len(labels["metadata.user_labels.name"]), ShouldEqual, 2)
					So(labels["metadata.user_labels.name"], ShouldContain, "name1")
					So(labels["metadata.user_labels.name"], ShouldContain, "name3")
				})
			})
			Convey("when data from query returns metadata system labels and alias by is defined", func() {
				data, err := loadTestFile("./test-data/5-series-response-meta-data.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				Convey("and systemlabel contains key with array of string", func() {
					res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
					query := &cloudMonitoringQuery{AliasBy: "{{metadata.system_labels.test}}"}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)
					So(len(res.Series), ShouldEqual, 3)
					fmt.Println(res.Series[0].Name)
					So(res.Series[0].Name, ShouldEqual, "value1, value2")
					So(res.Series[1].Name, ShouldEqual, "value1, value2, value3")
					So(res.Series[2].Name, ShouldEqual, "value1, value2, value4, value5")
				})

				Convey("and systemlabel contains key with array of string2", func() {
					res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
					query := &cloudMonitoringQuery{AliasBy: "{{metadata.system_labels.test2}}"}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)
					So(len(res.Series), ShouldEqual, 3)
					fmt.Println(res.Series[0].Name)
					So(res.Series[2].Name, ShouldEqual, "testvalue")
				})
			})

			Convey("when data from query returns slo and alias by is defined", func() {
				data, err := loadTestFile("./test-data/6-series-response-slo.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				Convey("and alias by is expanded", func() {
					res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
					query := &cloudMonitoringQuery{
						ProjectName: "test-proj",
						Selector:    "select_slo_compliance",
						Service:     "test-service",
						Slo:         "test-slo",
						AliasBy:     "{{project}} - {{service}} - {{slo}} - {{selector}}",
					}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)
					So(res.Series[0].Name, ShouldEqual, "test-proj - test-service - test-slo - select_slo_compliance")
				})
			})

			Convey("when data from query returns slo and alias by is not defined", func() {
				data, err := loadTestFile("./test-data/6-series-response-slo.json")
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				Convey("and alias by is expanded", func() {
					res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
					query := &cloudMonitoringQuery{
						ProjectName: "test-proj",
						Selector:    "select_slo_compliance",
						Service:     "test-service",
						Slo:         "test-slo",
					}
					err = executor.parseResponse(res, data, query)
					So(err, ShouldBeNil)
					So(res.Series[0].Name, ShouldEqual, "select_slo_compliance(\"projects/test-proj/services/test-service/serviceLevelObjectives/test-slo\")")
				})
			})
		})

		Convey("when interpolating filter wildcards", func() {
			Convey("and wildcard is used in the beginning and the end of the word", func() {
				Convey("and there's no wildcard in the middle of the word", func() {
					value := interpolateFilterWildcards("*-central1*")
					So(value, ShouldEqual, `has_substring("-central1")`)
				})
				Convey("and there is a wildcard in the middle of the word", func() {
					value := interpolateFilterWildcards("*-cent*ral1*")
					So(value, ShouldNotStartWith, `has_substring`)
				})
			})

			Convey("and wildcard is used in the beginning of the word", func() {
				Convey("and there is not a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*-central1")
					So(value, ShouldEqual, `ends_with("-central1")`)
				})
				Convey("and there is a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*-cent*al1")
					So(value, ShouldNotStartWith, `ends_with`)
				})
			})

			Convey("and wildcard is used at the end of the word", func() {
				Convey("and there is not a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("us-central*")
					So(value, ShouldEqual, `starts_with("us-central")`)
				})
				Convey("and there is a wildcard elsewhere in the word", func() {
					value := interpolateFilterWildcards("*us-central*")
					So(value, ShouldNotStartWith, `starts_with`)
				})
			})

			Convey("and wildcard is used in the middle of the word", func() {
				Convey("and there is only one wildcard", func() {
					value := interpolateFilterWildcards("us-ce*tral1-b")
					So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tral1\\-b$")`)
				})

				Convey("and there is more than one wildcard", func() {
					value := interpolateFilterWildcards("us-ce*tra*1-b")
					So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tra.*1\\-b$")`)
				})
			})

			Convey("and wildcard is used in the middle of the word and in the beginning of the word", func() {
				value := interpolateFilterWildcards("*s-ce*tral1-b")
				So(value, ShouldEqual, `monitoring.regex.full_match("^.*s\\-ce.*tral1\\-b$")`)
			})

			Convey("and wildcard is used in the middle of the word and in the ending of the word", func() {
				value := interpolateFilterWildcards("us-ce*tral1-*")
				So(value, ShouldEqual, `monitoring.regex.full_match("^us\\-ce.*tral1\\-.*$")`)
			})

			Convey("and no wildcard is used", func() {
				value := interpolateFilterWildcards("us-central1-a}")
				So(value, ShouldEqual, `us-central1-a}`)
			})
		})

		Convey("when building filter string", func() {
			Convey("and there's no regex operator", func() {
				Convey("and there are wildcards in a filter value", func() {
					filterParts := []string{"zone", "=", "*-central1*"}
					value := buildFilterString("somemetrictype", filterParts)
					So(value, ShouldEqual, `metric.type="somemetrictype" zone=has_substring("-central1")`)
				})

				Convey("and there are no wildcards in any filter value", func() {
					filterParts := []string{"zone", "!=", "us-central1-a"}
					value := buildFilterString("somemetrictype", filterParts)
					So(value, ShouldEqual, `metric.type="somemetrictype" zone!="us-central1-a"`)
				})
			})

			Convey("and there is a regex operator", func() {
				filterParts := []string{"zone", "=~", "us-central1-a~"}
				value := buildFilterString("somemetrictype", filterParts)
				Convey("it should remove the ~ character from the operator that belongs to the value", func() {
					So(value, ShouldNotContainSubstring, `=~`)
					So(value, ShouldContainSubstring, `zone=`)
				})

				Convey("it should insert monitoring.regex.full_match before filter value", func() {
					So(value, ShouldContainSubstring, `zone=monitoring.regex.full_match("us-central1-a~")`)
				})
			})
		})
	})
}

func loadTestFile(path string) (cloudMonitoringResponse, error) {
	var data cloudMonitoringResponse

	jsonBody, err := ioutil.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(jsonBody, &data)
	return data, err
}

func verifyDeepLink(dl string, expectedTimeSelection map[string]string, expectedTimeSeriesFilter map[string]interface{}) {
	u, err := url.Parse(dl)
	So(err, ShouldBeNil)
	So(u.Scheme, ShouldEqual, "https")
	So(u.Host, ShouldEqual, "accounts.google.com")
	So(u.Path, ShouldEqual, "/AccountChooser")

	params, err := url.ParseQuery(u.RawQuery)
	So(err, ShouldBeNil)

	continueParam := params.Get("continue")
	So(continueParam, ShouldNotBeEmpty)

	u, err = url.Parse(continueParam)
	So(err, ShouldBeNil)

	params, err = url.ParseQuery(u.RawQuery)
	So(err, ShouldBeNil)

	deepLinkParam := params.Get("Grafana_deeplink")
	So(deepLinkParam, ShouldNotBeEmpty)

	pageStateStr := params.Get("pageState")
	So(pageStateStr, ShouldNotBeEmpty)

	var pageState map[string]map[string]interface{}
	err = json.Unmarshal([]byte(pageStateStr), &pageState)
	So(err, ShouldBeNil)

	timeSelection, ok := pageState["timeSelection"]
	So(ok, ShouldBeTrue)
	for k, v := range expectedTimeSelection {
		s, ok := timeSelection[k].(string)
		So(ok, ShouldBeTrue)
		So(s, ShouldEqual, v)
	}

	dataSets, ok := pageState["xyChart"]["dataSets"].([]interface{})
	So(ok, ShouldBeTrue)
	So(len(dataSets), ShouldEqual, 1)
	dataSet, ok := dataSets[0].(map[string]interface{})
	So(ok, ShouldBeTrue)
	i, ok := dataSet["timeSeriesFilter"]
	So(ok, ShouldBeTrue)
	timeSeriesFilter := i.(map[string]interface{})
	for k, v := range expectedTimeSeriesFilter {
		s, ok := timeSeriesFilter[k]
		So(ok, ShouldBeTrue)
		rt := reflect.TypeOf(v)
		switch rt.Kind() {
		case reflect.Slice, reflect.Array:
			So(s, ShouldResemble, v)
		default:
			So(s, ShouldEqual, v)
		}
	}
}
