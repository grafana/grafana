package stackdriver

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStackdriver(t *testing.T) {
	Convey("Stackdriver", t, func() {
		executor := &StackdriverExecutor{}

		Convey("Parse queries from frontend and build Stackdriver API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"target":     "target",
							"metricType": "a/metric/type",
							"view":       "FULL",
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
				So(queries[0].Target, ShouldEqual, "target")
				So(len(queries[0].Params), ShouldEqual, 5)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_NONE")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
			})

			Convey("and query has aggregation mean set", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"target":             "target",
					"metricType":         "a/metric/type",
					"primaryAggregation": "REDUCE_MEAN",
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "target")
				So(len(queries[0].Params), ShouldEqual, 7)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.crossSeriesReducer"][0], ShouldEqual, "REDUCE_MEAN")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_MEAN")
				So(queries[0].Params["aggregation.alignmentPeriod"][0], ShouldEqual, "+60s")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
			})

			Convey("and query has group bys", func() {
				tsdbQuery.Queries[0].Model = simplejson.NewFromAny(map[string]interface{}{
					"target":             "target",
					"metricType":         "a/metric/type",
					"primaryAggregation": "REDUCE_NONE",
					"groupBys":           []interface{}{"metric.label.group1", "metric.label.group2"},
					"view":               "FULL",
				})

				queries, err := executor.buildQueries(tsdbQuery)
				So(err, ShouldBeNil)

				So(len(queries), ShouldEqual, 1)
				So(queries[0].RefID, ShouldEqual, "A")
				So(queries[0].Target, ShouldEqual, "target")
				So(len(queries[0].Params), ShouldEqual, 6)
				So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
				So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
				So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_NONE")
				So(queries[0].Params["aggregation.groupByFields"][0], ShouldEqual, "metric.label.group1")
				So(queries[0].Params["aggregation.groupByFields"][1], ShouldEqual, "metric.label.group2")
				So(queries[0].Params["filter"][0], ShouldEqual, "metric.type=\"a/metric/type\"")
				So(queries[0].Params["view"][0], ShouldEqual, "FULL")
			})

		})

		Convey("Parse stackdriver response in the time series format", func() {
			Convey("when data from query aggregated to one time series", func() {
				var data StackDriverResponse

				jsonBody, err := ioutil.ReadFile("./test-data/1-series-response-agg-one-metric.json")
				So(err, ShouldBeNil)
				err = json.Unmarshal(jsonBody, &data)
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 1)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				err = executor.parseResponse(res, data)
				So(err, ShouldBeNil)

				So(len(res.Series), ShouldEqual, 1)
				So(res.Series[0].Name, ShouldEqual, "serviceruntime.googleapis.com/api/request_count")
				So(len(res.Series[0].Points), ShouldEqual, 3)

				Convey("timestamps should be in ascending order", func() {
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 0.05)
					So(res.Series[0].Points[0][1].Float64, ShouldEqual, 1536670020000)

					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 1.05)
					So(res.Series[0].Points[1][1].Float64, ShouldEqual, 1536670080000)

					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 1.0666666666667)
					So(res.Series[0].Points[2][1].Float64, ShouldEqual, 1536670260000)
				})
			})

			Convey("when data from query with no aggregation", func() {
				var data StackDriverResponse

				jsonBody, err := ioutil.ReadFile("./test-data/2-series-response-no-agg.json")
				So(err, ShouldBeNil)
				err = json.Unmarshal(jsonBody, &data)
				So(err, ShouldBeNil)
				So(len(data.TimeSeries), ShouldEqual, 3)

				res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "A"}
				err = executor.parseResponse(res, data)
				So(err, ShouldBeNil)

				Convey("Should add labels to metric name", func() {
					So(len(res.Series), ShouldEqual, 3)
					So(res.Series[0].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-asia-east-1")
					So(res.Series[1].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-europe-west-1")
					So(res.Series[2].Name, ShouldEqual, "compute.googleapis.com/instance/cpu/usage_time collector-us-east-1")

					So(len(res.Series[0].Points), ShouldEqual, 3)
					So(res.Series[0].Points[0][0].Float64, ShouldEqual, 9.8566497180145)
					So(res.Series[0].Points[1][0].Float64, ShouldEqual, 9.7323568146676)
					So(res.Series[0].Points[2][0].Float64, ShouldEqual, 9.7730520330369)
				})

				Convey("Should add meta for labels to the response", func() {
					metricLabels := res.Meta.Get("metricLabels").Interface().(map[string][]string)
					So(metricLabels, ShouldNotBeNil)
					So(len(metricLabels["instance_name"]), ShouldEqual, 3)
					So(metricLabels["instance_name"][0], ShouldEqual, "collector-asia-east-1")
					So(metricLabels["instance_name"][1], ShouldEqual, "collector-europe-west-1")
					So(metricLabels["instance_name"][2], ShouldEqual, "collector-us-east-1")

					resourceLabels := res.Meta.Get("resourceLabels").Interface().(map[string][]string)
					So(resourceLabels, ShouldNotBeNil)
					So(len(resourceLabels["zone"]), ShouldEqual, 3)
					So(resourceLabels["zone"][0], ShouldEqual, "asia-east1-a")
					So(resourceLabels["zone"][1], ShouldEqual, "europe-west1-b")
					So(resourceLabels["zone"][2], ShouldEqual, "us-east1-b")

					So(len(resourceLabels["project_id"]), ShouldEqual, 1)
					So(resourceLabels["project_id"][0], ShouldEqual, "grafana-prod")
				})
			})
		})
	})
}
