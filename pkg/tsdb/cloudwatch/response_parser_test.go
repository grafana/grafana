package cloudwatch

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchResponseParser(t *testing.T) {
	Convey("TestCloudWatchResponseParser", t, func() {
		// e := &CloudWatchExecutor{
		// 	DataSource: &models.DataSource{
		// 		JsonData: simplejson.New(),
		// 	},
		// }

		// Convey("can parse cloudwatch response", func() {
		// 	timestamp := time.Unix(0, 0)
		// 	resp := map[string]*cloudwatch.MetricDataResult{
		// 		"label": {
		// 			Id:    aws.String("id1"),
		// 			Label: aws.String("label"),
		// 			Timestamps: []*time.Time{
		// 				aws.Time(timestamp),
		// 				aws.Time(timestamp.Add(60 * time.Second)),
		// 				aws.Time(timestamp.Add(180 * time.Second)),
		// 			},
		// 			Values: []*float64{
		// 				aws.Float64(10),
		// 				aws.Float64(20),
		// 				aws.Float64(30),
		// 			},
		// 			StatusCode: aws.String("Complete"),
		// 		},
		// 	}

		// 	dimensions := make(map[string][]string)
		// 	dimensions["LoadBalancer"] = []string{"lb"}
		// 	dimensions["TargetGroup"] = []string{"tg"}

		// 	query := &CloudWatchQuery{
		// 		RefId:      "refId1",
		// 		Region:     "us-east-1",
		// 		Namespace:  "AWS/ApplicationELB",
		// 		MetricName: "TargetResponseTime",
		// 		Dimensions: dimensions,
		// 		Statistics: []*string{aws.String("Average")},
		// 		Period:     60,
		// 		Alias:      "{{namespace}}_{{metric}}_{{stat}}",
		// 	}
		// 	series, err := parseGetMetricDataTimeSeries(resp, query, *query.Statistics[0])
		// 	timeSeries := (*series)[0]

		// 	So(err, ShouldBeNil)
		// 	So(timeSeries.Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
		// 	So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb")
		// 	So(timeSeries.Tags["TargetGroup"], ShouldEqual, "tg")
		// 	So(timeSeries.Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
		// 	So(timeSeries.Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
		// 	So(timeSeries.Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
		// 	So(timeSeries.Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
		// })
	})
}
