package cloudwatch

import (
	"log"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchResponseParser(t *testing.T) {
	FocusConvey("TestCloudWatchResponseParser", t, func() {
		FocusConvey("can expand dimension value using exact match", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)
			timeSeries := (*series)[0]

			log.Println("series")
			log.Println(prettyPrint(series))

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")
			So(timeSeries.Points, ShouldHaveLength, 3)

			timeSeries2 := (*series)[1]
			So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")
			So(timeSeries2.Points, ShouldHaveLength, 3)
		})

		Convey("can expand dimension value using substring", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)
			timeSeries := (*series)[0]
			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")

			timeSeries2 := (*series)[1]
			So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")
		})

		Convey("can expand alias when there's no data returned", func() {
			resp := map[string]*cloudwatch.MetricDataResult{}
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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)

			log.Println("series")
			log.Println(prettyPrint(series))

			timeSeries := (*series)[0]
			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")

			timeSeries2 := (*series)[1]
			So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")

		})

		Convey("can expand alias when there's partial data returned", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)

			log.Println("series")
			log.Println(prettyPrint(series))

			timeSeries := (*series)[0]
			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So(timeSeries.Name, ShouldEqual, "lb1 Expanded")
			So(timeSeries.Tags["LoadBalancer"], ShouldEqual, "lb1")

			// timeSeries2 := (*series)[1]
			// So(timeSeries2.Name, ShouldEqual, "lb2 Expanded")
			// So(timeSeries2.Tags["LoadBalancer"], ShouldEqual, "lb2")

		})

		Convey("can expand dimension value using wildcard", func() {
			timestamp := time.Unix(0, 0)
			resp := map[string]*cloudwatch.MetricDataResult{
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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)

			So(err, ShouldBeNil)
			So(partialData, ShouldBeFalse)
			So((*series)[0].Name, ShouldEqual, "lb3 Expanded")
			So((*series)[1].Name, ShouldEqual, "lb4 Expanded")
		})

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
			series, partialData, err := parseGetMetricDataTimeSeries(resp, query)
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
