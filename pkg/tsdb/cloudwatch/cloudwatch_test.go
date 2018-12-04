package cloudwatch

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatch(t *testing.T) {
	Convey("CloudWatch", t, func() {

		Convey("executeQuery", func() {
			e := &CloudWatchExecutor{
				DataSource: &models.DataSource{
					JsonData: simplejson.New(),
				},
			}

			Convey("End time before start time should result in error", func() {
				_, err := e.executeQuery(context.Background(), &CloudWatchQuery{}, &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := e.executeQuery(context.Background(), &CloudWatchQuery{}, &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})

		Convey("can parse cloudwatch json model", func() {
			json := `
				{
					"region": "us-east-1",
					"namespace": "AWS/ApplicationELB",
					"metricName": "TargetResponseTime",
					"dimensions": {
						"LoadBalancer": "lb",
						"TargetGroup": "tg"
					},
					"statistics": [
						"Average",
						"Maximum",
						"p50.00",
						"p90.00"
					],
					"period": "60",
					"highResolution": false,
					"alias": "{{metric}}_{{stat}}"
				}
			`
			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			res, err := parseQuery(modelJson)
			So(err, ShouldBeNil)
			So(res.Region, ShouldEqual, "us-east-1")
			So(res.Namespace, ShouldEqual, "AWS/ApplicationELB")
			So(res.MetricName, ShouldEqual, "TargetResponseTime")
			So(len(res.Dimensions), ShouldEqual, 2)
			So(*res.Dimensions[0].Name, ShouldEqual, "LoadBalancer")
			So(*res.Dimensions[0].Value, ShouldEqual, "lb")
			So(*res.Dimensions[1].Name, ShouldEqual, "TargetGroup")
			So(*res.Dimensions[1].Value, ShouldEqual, "tg")
			So(len(res.Statistics), ShouldEqual, 2)
			So(*res.Statistics[0], ShouldEqual, "Average")
			So(*res.Statistics[1], ShouldEqual, "Maximum")
			So(len(res.ExtendedStatistics), ShouldEqual, 2)
			So(*res.ExtendedStatistics[0], ShouldEqual, "p50.00")
			So(*res.ExtendedStatistics[1], ShouldEqual, "p90.00")
			So(res.Period, ShouldEqual, 60)
			So(res.Alias, ShouldEqual, "{{metric}}_{{stat}}")
		})

		Convey("can parse cloudwatch response", func() {
			timestamp := time.Unix(0, 0)
			resp := &cloudwatch.GetMetricStatisticsOutput{
				Label: aws.String("TargetResponseTime"),
				Datapoints: []*cloudwatch.Datapoint{
					{
						Timestamp: aws.Time(timestamp),
						Average:   aws.Float64(10.0),
						Maximum:   aws.Float64(20.0),
						ExtendedStatistics: map[string]*float64{
							"p50.00": aws.Float64(30.0),
							"p90.00": aws.Float64(40.0),
						},
						Unit: aws.String("Seconds"),
					},
				},
			}
			query := &CloudWatchQuery{
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
				Statistics:         []*string{aws.String("Average"), aws.String("Maximum")},
				ExtendedStatistics: []*string{aws.String("p50.00"), aws.String("p90.00")},
				Period:             60,
				Alias:              "{{namespace}}_{{metric}}_{{stat}}",
			}

			queryRes, err := parseResponse(resp, query)
			So(err, ShouldBeNil)
			So(queryRes.Series[0].Name, ShouldEqual, "AWS/ApplicationELB_TargetResponseTime_Average")
			So(queryRes.Series[0].Tags["LoadBalancer"], ShouldEqual, "lb")
			So(queryRes.Series[0].Tags["TargetGroup"], ShouldEqual, "tg")
			So(queryRes.Series[0].Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(queryRes.Series[1].Points[0][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(queryRes.Series[2].Points[0][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
			So(queryRes.Series[3].Points[0][0].String(), ShouldEqual, null.FloatFrom(40.0).String())
			So(queryRes.Meta.Get("unit").MustString(), ShouldEqual, "s")
		})

		Convey("terminate gap of data points", func() {
			timestamp := time.Unix(0, 0)
			resp := &cloudwatch.GetMetricStatisticsOutput{
				Label: aws.String("TargetResponseTime"),
				Datapoints: []*cloudwatch.Datapoint{
					{
						Timestamp: aws.Time(timestamp),
						Average:   aws.Float64(10.0),
						Maximum:   aws.Float64(20.0),
						ExtendedStatistics: map[string]*float64{
							"p50.00": aws.Float64(30.0),
							"p90.00": aws.Float64(40.0),
						},
						Unit: aws.String("Seconds"),
					},
					{
						Timestamp: aws.Time(timestamp.Add(60 * time.Second)),
						Average:   aws.Float64(20.0),
						Maximum:   aws.Float64(30.0),
						ExtendedStatistics: map[string]*float64{
							"p50.00": aws.Float64(40.0),
							"p90.00": aws.Float64(50.0),
						},
						Unit: aws.String("Seconds"),
					},
					{
						Timestamp: aws.Time(timestamp.Add(180 * time.Second)),
						Average:   aws.Float64(30.0),
						Maximum:   aws.Float64(40.0),
						ExtendedStatistics: map[string]*float64{
							"p50.00": aws.Float64(50.0),
							"p90.00": aws.Float64(60.0),
						},
						Unit: aws.String("Seconds"),
					},
				},
			}
			query := &CloudWatchQuery{
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
				Statistics:         []*string{aws.String("Average"), aws.String("Maximum")},
				ExtendedStatistics: []*string{aws.String("p50.00"), aws.String("p90.00")},
				Period:             60,
				Alias:              "{{namespace}}_{{metric}}_{{stat}}",
			}

			queryRes, err := parseResponse(resp, query)
			So(err, ShouldBeNil)
			So(queryRes.Series[0].Points[0][0].String(), ShouldEqual, null.FloatFrom(10.0).String())
			So(queryRes.Series[1].Points[0][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(queryRes.Series[2].Points[0][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
			So(queryRes.Series[3].Points[0][0].String(), ShouldEqual, null.FloatFrom(40.0).String())
			So(queryRes.Series[0].Points[1][0].String(), ShouldEqual, null.FloatFrom(20.0).String())
			So(queryRes.Series[1].Points[1][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
			So(queryRes.Series[2].Points[1][0].String(), ShouldEqual, null.FloatFrom(40.0).String())
			So(queryRes.Series[3].Points[1][0].String(), ShouldEqual, null.FloatFrom(50.0).String())
			So(queryRes.Series[0].Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(queryRes.Series[1].Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(queryRes.Series[2].Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(queryRes.Series[3].Points[2][0].String(), ShouldEqual, null.FloatFromPtr(nil).String())
			So(queryRes.Series[0].Points[3][0].String(), ShouldEqual, null.FloatFrom(30.0).String())
			So(queryRes.Series[1].Points[3][0].String(), ShouldEqual, null.FloatFrom(40.0).String())
			So(queryRes.Series[2].Points[3][0].String(), ShouldEqual, null.FloatFrom(50.0).String())
			So(queryRes.Series[3].Points[3][0].String(), ShouldEqual, null.FloatFrom(60.0).String())
		})
	})
}
