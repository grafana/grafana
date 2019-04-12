package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchGetMetricData(t *testing.T) {
	Convey("CloudWatchGetMetricData", t, func() {

		Convey("can parse cloudwatch json model", func() {
			queries := map[string]*CloudWatchQuery{
				"id1": {
					RefId:      "A",
					Region:     "us-east-1",
					Namespace:  "AWS/EC2",
					MetricName: "CPUUtilization",
					Dimensions: []*cloudwatch.Dimension{
						{
							Name:  aws.String("InstanceId"),
							Value: aws.String("i-12345678"),
						},
					},
					Statistics: []*string{aws.String("Average")},
					Period:     300,
					Id:         "id1",
					Expression: "",
					ReturnData: true,
				},
				"id2": {
					RefId:      "B",
					Region:     "us-east-1",
					Statistics: []*string{aws.String("Average")},
					Id:         "id2",
					Expression: "id1 * 2",
					ReturnData: true,
				},
			}
			queryContext := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
			}
			res, err := parseGetMetricDataQuery(queries, queryContext)
			So(err, ShouldBeNil)
			So(*res.MetricDataQueries[0].MetricStat.Metric.Namespace, ShouldEqual, "AWS/EC2")
			So(*res.MetricDataQueries[0].MetricStat.Metric.MetricName, ShouldEqual, "CPUUtilization")
			So(*res.MetricDataQueries[0].MetricStat.Metric.Dimensions[0].Name, ShouldEqual, "InstanceId")
			So(*res.MetricDataQueries[0].MetricStat.Metric.Dimensions[0].Value, ShouldEqual, "i-12345678")
			So(*res.MetricDataQueries[0].MetricStat.Period, ShouldEqual, 300)
			So(*res.MetricDataQueries[0].MetricStat.Stat, ShouldEqual, "Average")
			So(*res.MetricDataQueries[0].Id, ShouldEqual, "id1")
			So(*res.MetricDataQueries[0].ReturnData, ShouldEqual, true)
			So(*res.MetricDataQueries[1].Id, ShouldEqual, "id2")
			So(*res.MetricDataQueries[1].Expression, ShouldEqual, "id1 * 2")
			So(*res.MetricDataQueries[1].ReturnData, ShouldEqual, true)
		})
	})
}
