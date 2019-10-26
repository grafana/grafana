package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryBuilder(t *testing.T) {
	Convey("QueryBuilder", t, func() {
		Convey("when parsing query editor row json", func() {
			Convey("using new dimensions structure", func() {
				query := simplejson.NewFromAny(map[string]interface{}{
					"refId":      "ref1",
					"region":     "us-east-1",
					"namespace":  "ec2",
					"metricName": "CPUUtilization",
					"id":         "",
					"expression": "",
					"dimensions": map[string]interface{}{
						"InstanceId":   []interface{}{"test"},
						"InstanceType": []interface{}{"test2", "test3"},
					},
					"statistics":     []interface{}{"Average"},
					"period":         "600",
					"hide":           false,
					"highResolution": false,
				})

				res, err := parseQueryEditorRow(query, "ref1")
				So(err, ShouldBeNil)
				So(res.Region, ShouldEqual, "us-east-1")
				So(res.RefId, ShouldEqual, "ref1")
				So(res.Namespace, ShouldEqual, "ec2")
				So(res.MetricName, ShouldEqual, "CPUUtilization")
				So(res.Id, ShouldEqual, "")
				So(res.Expression, ShouldEqual, "")
				So(res.Period, ShouldEqual, 600)
				So(res.ReturnData, ShouldEqual, true)
				So(res.HighResolution, ShouldEqual, false)
				So(len(res.Dimensions), ShouldEqual, 2)
				So(len(res.Dimensions["InstanceId"]), ShouldEqual, 1)
				So(len(res.Dimensions["InstanceType"]), ShouldEqual, 2)
				So(res.Dimensions["InstanceType"][1], ShouldEqual, "test3")
				So(len(res.Statistics), ShouldEqual, 1)
				So(*res.Statistics[0], ShouldEqual, "Average")
			})

			Convey("using old dimensions structure (backwards compatibility)", func() {
				query := simplejson.NewFromAny(map[string]interface{}{
					"refId":      "ref1",
					"region":     "us-east-1",
					"namespace":  "ec2",
					"metricName": "CPUUtilization",
					"id":         "",
					"expression": "",
					"dimensions": map[string]interface{}{
						"InstanceId":   "test",
						"InstanceType": "test2",
					},
					"statistics":     []interface{}{"Average"},
					"period":         "600",
					"hide":           false,
					"highResolution": false,
				})

				res, err := parseQueryEditorRow(query, "ref1")
				So(err, ShouldBeNil)
				So(res.Region, ShouldEqual, "us-east-1")
				So(res.RefId, ShouldEqual, "ref1")
				So(res.Namespace, ShouldEqual, "ec2")
				So(res.MetricName, ShouldEqual, "CPUUtilization")
				So(res.Id, ShouldEqual, "")
				So(res.Expression, ShouldEqual, "")
				So(res.Period, ShouldEqual, 600)
				So(res.ReturnData, ShouldEqual, true)
				So(res.HighResolution, ShouldEqual, false)
				So(len(res.Dimensions), ShouldEqual, 2)
				So(len(res.Dimensions["InstanceId"]), ShouldEqual, 1)
				So(len(res.Dimensions["InstanceType"]), ShouldEqual, 1)
				So(res.Dimensions["InstanceType"][0], ShouldEqual, "test2")
				So(*res.Statistics[0], ShouldEqual, "Average")
			})
		})

		Convey("when parsing queries", func() {

			executor := &CloudWatchExecutor{}
			tsdbQuery := &tsdb.TsdbQuery{
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
			Convey("one cloudwatchQuery is generated when there's one stat", func() {
				tsdbQuery.Queries = []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"refId":          "D",
							"region":         "us-east-1",
							"namespace":      "ec2",
							"metricName":     "CPUUtilization",
							"id":             "",
							"statistics":     []interface{}{"Average"},
							"period":         "600",
							"hide":           false,
							"highResolution": false,
						}),
						RefId: "D",
					},
				}

				res, err := executor.parseQueries(tsdbQuery)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 1)
			})

			Convey("two cloudwatchQuery is generated when there's two stats", func() {
				tsdbQuery.Queries = []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"refId":          "D",
							"region":         "us-east-1",
							"namespace":      "ec2",
							"metricName":     "CPUUtilization",
							"id":             "",
							"statistics":     []interface{}{"Average", "Sum"},
							"period":         "600",
							"hide":           false,
							"highResolution": false,
						}),
						RefId: "D",
					},
				}

				res, err := executor.parseQueries(tsdbQuery)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 2)
			})
			Convey("and id is given by user", func() {
				Convey("that id will be used in the cloudwatch query", func() {
					tsdbQuery.Queries = []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"refId":          "D",
								"region":         "us-east-1",
								"namespace":      "ec2",
								"metricName":     "CPUUtilization",
								"id":             "myid",
								"statistics":     []interface{}{"Average"},
								"period":         "600",
								"hide":           false,
								"highResolution": false,
							}),
							RefId: "D",
						},
					}

					res, err := executor.parseQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(res, ShouldContainKey, "myid")
				})
			})

			Convey("and id is not given by user", func() {
				Convey("id will be generated based on ref id if query only has one stat", func() {
					tsdbQuery.Queries = []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"refId":          "D",
								"region":         "us-east-1",
								"namespace":      "ec2",
								"metricName":     "CPUUtilization",
								"id":             "",
								"statistics":     []interface{}{"Average"},
								"period":         "600",
								"hide":           false,
								"highResolution": false,
							}),
							RefId: "D",
						},
					}

					res, err := executor.parseQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(res, ShouldContainKey, "queryD")
				})

				Convey("id will be generated based on ref and stat name if query has two stats", func() {
					tsdbQuery.Queries = []*tsdb.Query{
						{
							Model: simplejson.NewFromAny(map[string]interface{}{
								"refId":          "D",
								"region":         "us-east-1",
								"namespace":      "ec2",
								"metricName":     "CPUUtilization",
								"id":             "",
								"statistics":     []interface{}{"Average", "Sum"},
								"period":         "600",
								"hide":           false,
								"highResolution": false,
							}),
							RefId: "D",
						},
					}

					res, err := executor.parseQueries(tsdbQuery)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 2)
					So(res, ShouldContainKey, "queryD_Sum")
					So(res, ShouldContainKey, "queryD_Average")
				})
			})

			Convey("dot should be removed when query has more than one stat and one of them is a percentile", func() {
				tsdbQuery.Queries = []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"refId":          "D",
							"region":         "us-east-1",
							"namespace":      "ec2",
							"metricName":     "CPUUtilization",
							"id":             "",
							"statistics":     []interface{}{"Average", "p46.32"},
							"period":         "600",
							"hide":           false,
							"highResolution": false,
						}),
						RefId: "D",
					},
				}

				res, err := executor.parseQueries(tsdbQuery)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 2)
				So(res, ShouldContainKey, "queryD_p46_32")
			})

			Convey("should throw an error if two queries has the same id", func() {
				tsdbQuery.Queries = []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"refId":          "D",
							"region":         "us-east-1",
							"namespace":      "ec2",
							"metricName":     "CPUUtilization",
							"id":             "myid",
							"statistics":     []interface{}{"Average", "p46.32"},
							"period":         "600",
							"hide":           false,
							"highResolution": false,
						}),
						RefId: "D",
					},
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"refId":          "E",
							"region":         "us-east-1",
							"namespace":      "ec2",
							"metricName":     "CPUUtilization",
							"id":             "myid",
							"statistics":     []interface{}{"Average", "p46.32"},
							"period":         "600",
							"hide":           false,
							"highResolution": false,
						}),
						RefId: "E",
					},
				}

				res, err := executor.parseQueries(tsdbQuery)
				So(res, ShouldBeNil)
				So(err, ShouldNotBeNil)
			})
		})
	})
}
