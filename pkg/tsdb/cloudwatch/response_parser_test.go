package cloudwatch

import (
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchResponseParser(t *testing.T) {
	Convey("TestCloudWatchResponseParser", t, func() {

		Convey("can parse cloudwatch response", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
				"lb": {
					Id:    aws.String("id1"),
					Label: aws.String("lb"),
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

			query := &cloudWatchQuery{
				RefId:      "refId1",
				Region:     "us-east-1",
				Namespace:  "AWS/ApplicationELB",
				MetricName: "TargetResponseTime",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb"},
					"TargetGroup":  {"tg"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{namespace}}_{{metric}}_{{stat}}",
			}
			series, err := parseGetMetricDataTimeSeries(resp, query)
			timeSeries := (*series)[0]

			So(err, ShouldBeNil)
			So(timeSeries.Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb")
			So(timeSeries.Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(timeSeries.Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(timeSeries.Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(timeSeries.Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
		})
	})
}
