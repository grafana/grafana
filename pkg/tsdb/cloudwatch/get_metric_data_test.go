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

		Convey("can parse cloudwatch GetMetricData query", func() {
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

			for _, v := range res.MetricDataQueries {
				if *v.Id == "id1" {
					So(*v.MetricStat.Metric.Namespace, ShouldEqual, "AWS/EC2")
					So(*v.MetricStat.Metric.MetricName, ShouldEqual, "CPUUtilization")
					So(*v.MetricStat.Metric.Dimensions[0].Name, ShouldEqual, "InstanceId")
					So(*v.MetricStat.Metric.Dimensions[0].Value, ShouldEqual, "i-12345678")
					So(*v.MetricStat.Period, ShouldEqual, 300)
					So(*v.MetricStat.Stat, ShouldEqual, "Average")
					So(*v.Id, ShouldEqual, "id1")
					So(*v.ReturnData, ShouldEqual, true)
				} else {
					So(*v.Id, ShouldEqual, "id2")
					So(*v.Expression, ShouldEqual, "id1 * 2")
					So(*v.ReturnData, ShouldEqual, true)
				}
			}
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
			query := &CloudWatchQuery{
				RefId:      "refId1",
				Region:     "us-east-1",
				Namespace:  "AWS/ApplicationELB",
				MetricName: "TargetResponseTime",
				Dimensions: []*cloudwatch.Dimension{
					{
						Name:  aws.String("LoadBalancer"),
						Value: aws.String("lb"),
					},
					{
						Name:  aws.String("TargetGroup"),
						Value: aws.String("tg"),
					},
				},
				Statistics: []*string{aws.String("Average")},
				Period:     60,
				Alias:      "{{namespace}}_{{metric}}_{{stat}}",
			}
			queryRes, err := parseGetMetricDataResponse(resp, query)
			So(err, ShouldBeNil)
			So(queryRes.RefId, ShouldEqual, "refId1")
			So(queryRes.Series[0].Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
			So(queryRes.Series[0].Tags["LoadBalancer"], ShouldEqual, "lb")
			So(queryRes.Series[0].Tags["TargetGroup"], ShouldEqual, "tg")
			So(queryRes.Series[0].Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(queryRes.Series[0].Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(queryRes.Series[0].Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(queryRes.Series[0].Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
		})
	})
}
