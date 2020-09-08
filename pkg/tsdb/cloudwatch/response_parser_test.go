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
		Convey("can expand dimension value using exact match", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb1", "lb2"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
				"lb1": {
					Id:    aws.String("id1"),
					Label: aws.String("lb1"),
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
				"lb2": {
					Id:    aws.String("id2"),
					Label: aws.String("lb2"),
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
					"LoadBalancer": {"lb1", "lb2"},
					"TargetGroup":  {"tg"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{LoadBalancer}} Expanded",
			}
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
			timeSeries := (*series)[0]

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")

			timeSeries2 := (*series)[1]
			So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")
		})

		Convey("can expand dimension value using substring", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb1 Sum", "lb2 Average"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
				"lb1 Sum": {
					Id:    aws.String("id1"),
					Label: aws.String("lb1 Sum"),
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
				"lb2 Average": {
					Id:    aws.String("id2"),
					Label: aws.String("lb2 Average"),
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
					"LoadBalancer": {"lb1", "lb2"},
					"TargetGroup":  {"tg"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{LoadBalancer}} Expanded",
			}
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
			timeSeries := (*series)[0]
			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")

			timeSeries2 := (*series)[1]
			So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")
		})

		Convey("can expand dimension value using wildcard", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb3", "lb4"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
				"lb3": {
					Id:    aws.String("lb3"),
					Label: aws.String("lb3"),
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
				"lb4": {
					Id:    aws.String("lb4"),
					Label: aws.String("lb4"),
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
					"LoadBalancer": {"*"},
					"TargetGroup":  {"tg"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{LoadBalancer}} Expanded",
			}
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So((*series)[0].Name, ShouldEqual, "lb3 Expanded")
			So((*series)[1].Name, ShouldEqual, "lb4 Expanded")
		})

		Convey("can expand dimension value when no values are returned and a multi-valued template variable is used", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb3"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
				"lb3": {
					Id:    aws.String("lb3"),
					Label: aws.String("lb3"),
					Timestamps: []*time.Time{
						aws.Time(timestamp),
						aws.Time(timestamp.Add(60 * time.Second)),
						aws.Time(timestamp.Add(180 * time.Second)),
					},
					Values:     []*float64{},
					StatusCode: aws.String("Complete"),
				},
			}

			query := &cloudWatchQuery{
				RefId:      "refId1",
				Region:     "us-east-1",
				Namespace:  "AWS/ApplicationELB",
				MetricName: "TargetResponseTime",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{LoadBalancer}} Expanded",
			}
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(len(*series), ShouldEqual, 2)
			So((*series)[0].Name, ShouldEqual, "lb1 Expanded")
			So((*series)[1].Name, ShouldEqual, "lb2 Expanded")
		})

		Convey("can expand dimension value when no values are returned and a multi-valued template variable and two single-valued dimensions are used", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb3"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
				"lb3": {
					Id:    aws.String("lb3"),
					Label: aws.String("lb3"),
					Timestamps: []*time.Time{
						aws.Time(timestamp),
						aws.Time(timestamp.Add(60 * time.Second)),
						aws.Time(timestamp.Add(180 * time.Second)),
					},
					Values:     []*float64{},
					StatusCode: aws.String("Complete"),
				},
			}

			query := &cloudWatchQuery{
				RefId:      "refId1",
				Region:     "us-east-1",
				Namespace:  "AWS/ApplicationELB",
				MetricName: "TargetResponseTime",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2"},
					"InstanceType": {"micro"},
					"Resource":     {"res"},
				},
				Stats:  "Average",
				Period: 60,
				Alias:  "{{LoadBalancer}} Expanded {{InstanceType}} - {{Resource}}",
			}
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(len(*series), ShouldEqual, 2)
			So((*series)[0].Name, ShouldEqual, "lb1 Expanded micro - res")
			So((*series)[1].Name, ShouldEqual, "lb2 Expanded micro - res")
		})

		Convey("can parse cloudwatch response", func() {
			timestamp := time.Unix(0, 0)
			labels := []string{"lb"}
			mdrs := map[string]*cloudwatch.MetricDataResult{
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
			series, partialData, err := parseGetMetricDataTimeSeries(mdrs, labels, query)
			timeSeries := (*series)[0]

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb")
			So(timeSeries.Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(timeSeries.Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(timeSeries.Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(timeSeries.Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
		})
	})
}
