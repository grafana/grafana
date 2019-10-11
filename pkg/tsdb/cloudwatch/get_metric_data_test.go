package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchGetMetricData(t *testing.T) {
	Convey("CloudWatchGetMetricData", t, func() {

		Convey("build GetMetricDataInput data from grafana queries", func() {
			Convey("and one GetMetricDataInput is generated for each query statistic", func() {
				dimensions := make(map[string][]string)
				dimensions["InstanceId"] = []string{"i-12345678"}
				queries := map[string]*CloudWatchQuery{
					"id1": {
						RefId:      "A",
						Region:     "us-east-1",
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: dimensions,
						Statistics: []*string{aws.String("Average"), aws.String("Sum")},
						Period:     300,
						Id:         "id1",
						Identifier: "id1",
						Expression: "",
					},
				}

				queryContext := &tsdb.TsdbQuery{
					TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				}
				res, err := buildGetMetricDataQuery(queries, queryContext)
				So(err, ShouldBeNil)
				So(len(res.MetricDataQueries), ShouldEqual, 2)
				So(*res.MetricDataQueries[0].Id, ShouldEqual, "id1_____0")
				So(*res.MetricDataQueries[1].Id, ShouldEqual, "id1_____1")
			})

			Convey("and query expression will be used if it was set in query editor", func() {
				queries := map[string]*CloudWatchQuery{
					"id1": {
						RefId:      "A",
						Region:     "us-east-1",
						Expression: "SEARCH(someexpression)",
						Statistics: []*string{aws.String("Average")},
						Period:     300,
						Id:         "id1",
						Identifier: "id1",
					},
				}

				queryContext := &tsdb.TsdbQuery{
					TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				}
				res, err := buildGetMetricDataQuery(queries, queryContext)
				So(err, ShouldBeNil)
				So(len(res.MetricDataQueries), ShouldEqual, 1)
				So(*res.MetricDataQueries[0].Expression, ShouldEqual, "SEARCH(someexpression)")
			})

			Convey("and query expression is being generated server side", func() {
				Convey("and query has three dimension values for a given dimension key", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"lb1", "lb2", "lb3"}
					queries := map[string]*CloudWatchQuery{
						"id1": {
							Namespace:  "AWS/EC2",
							MetricName: "CPUUtilization",
							Dimensions: dimensions,
							Statistics: []*string{aws.String("Average")},
							Period:     300,
							Identifier: "id1",
							Expression: "",
						},
					}

					queryContext := &tsdb.TsdbQuery{
						TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
					}
					res, err := buildGetMetricDataQuery(queries, queryContext)
					So(err, ShouldBeNil)
					So(len(res.MetricDataQueries), ShouldEqual, 1)
					So(*res.MetricDataQueries[0].Expression, ShouldEqual, "SEARCH('{AWS/EC2,LoadBalancer} MetricName=\"CPUUtilization\" (LoadBalancer=\"lb1\" OR LoadBalancer=\"lb2\" OR LoadBalancer=\"lb3\")', 'Average', 300)")
				})

				Convey("and query has three dimension values for two given dimension keys", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"lb1", "lb2", "lb3"}
					dimensions["InstanceId"] = []string{"i-123", "i-456", "i-789"}
					queries := map[string]*CloudWatchQuery{
						"id1": {
							Namespace:  "AWS/EC2",
							MetricName: "CPUUtilization",
							Dimensions: dimensions,
							Statistics: []*string{aws.String("Average")},
							Period:     300,
							Identifier: "id1",
							Expression: "",
						},
					}

					queryContext := &tsdb.TsdbQuery{
						TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
					}
					res, err := buildGetMetricDataQuery(queries, queryContext)
					So(err, ShouldBeNil)
					So(len(res.MetricDataQueries), ShouldEqual, 1)
					So(*res.MetricDataQueries[0].Expression, ShouldEqual, "SEARCH('{AWS/EC2,LoadBalancer,InstanceId} MetricName=\"CPUUtilization\" (LoadBalancer=\"lb1\" OR LoadBalancer=\"lb2\" OR LoadBalancer=\"lb3\") AND (InstanceId=\"i-123\" OR InstanceId=\"i-456\" OR InstanceId=\"i-789\")', 'Average', 300)")
				})

				Convey("and no AND/OR operators were added if no dimension keys exist", func() {
					dimensions := make(map[string][]string)
					queries := map[string]*CloudWatchQuery{
						"id1": {
							Namespace:  "AWS/EC2",
							MetricName: "CPUUtilization",
							Dimensions: dimensions,
							Statistics: []*string{aws.String("Average")},
							Period:     300,
							Identifier: "id1",
							Expression: "",
						},
					}

					queryContext := &tsdb.TsdbQuery{
						TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
					}
					res, err := buildGetMetricDataQuery(queries, queryContext)
					So(err, ShouldBeNil)
					So(len(res.MetricDataQueries), ShouldEqual, 1)
					So(*res.MetricDataQueries[0].Expression, ShouldNotContainSubstring, "AND")
					So(*res.MetricDataQueries[0].Expression, ShouldNotContainSubstring, "OR")
				})

				Convey("and no OR operators were added if no dimension key values", func() {
					dimensions := make(map[string][]string)
					dimensions["InstanceId"] = []string{}
					queries := map[string]*CloudWatchQuery{
						"id1": {
							Namespace:  "AWS/EC2",
							MetricName: "CPUUtilization",
							Dimensions: dimensions,
							Statistics: []*string{aws.String("Average")},
							Period:     300,
							Identifier: "id1",
							Expression: "",
						},
					}

					queryContext := &tsdb.TsdbQuery{
						TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
					}
					res, err := buildGetMetricDataQuery(queries, queryContext)
					So(err, ShouldBeNil)
					So(len(res.MetricDataQueries), ShouldEqual, 1)
					So(*res.MetricDataQueries[0].Expression, ShouldNotContainSubstring, "OR")
				})
			})
		})

		Convey("can parse cloudwatch response", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
				"label": {
					Id:    aws.String("id1"),
					Label: aws.String("label"),
					Timestamps: []*time.Time{
						aws.Time(timestamp),
						aws.Time(timestamp.Add(60 * time.Second)),
						aws.Time(timestamp.Add(180 * time.Second)),
					},
					Values: []*float64{
						aws.Float64(10),
						aws.Float64(20),
						aws.Float64(30),
					},
					StatusCode: aws.String("Complete"),
				},
			}

			dimensions := make(map[string][]string)
			dimensions["LoadBalancer"] = []string{"lb"}
			dimensions["TargetGroup"] = []string{"tg"}

			query := &CloudWatchQuery{
				RefId:      "refId1",
				Region:     "us-east-1",
				Namespace:  "AWS/ApplicationELB",
				MetricName: "TargetResponseTime",
				Dimensions: dimensions,
				Statistics: []*string{aws.String("Average")},
				Period:     60,
				Alias:      "{{namespace}}_{{metric}}_{{stat}}",
			}
			series, err := parseGetMetricDataTimeSeries(resp, query, *query.Statistics[0])
			timeSeries := (*series)[0]

			So(err, ShouldBeNil)
			So(timeSeries.Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb")
			So(timeSeries.Tags["TargetGroup"], ShouldEqual, "tg")
			So(timeSeries.Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(timeSeries.Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(timeSeries.Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(timeSeries.Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
		})
	})
}
