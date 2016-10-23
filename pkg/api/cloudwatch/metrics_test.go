package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchMetrics(t *testing.T) {

	Convey("When calling getMetricsForCustomMetrics", t, func() {
		region := "us-east-1"
		namespace := "Foo"
		database := "default"
		assumeRoleArn := ""
		f := func(region string, namespace string, database string, assumeRoleArn string) (cloudwatch.ListMetricsOutput, error) {
			return cloudwatch.ListMetricsOutput{
				Metrics: []*cloudwatch.Metric{
					{
						MetricName: aws.String("Test_MetricName"),
						Dimensions: []*cloudwatch.Dimension{
							{
								Name: aws.String("Test_DimensionName"),
							},
						},
					},
				},
			}, nil
		}
		metrics, _ := getMetricsForCustomMetrics(region, namespace, database, assumeRoleArn, f)

		Convey("Should contain Test_MetricName", func() {
			So(metrics, ShouldContain, "Test_MetricName")
		})
	})

	Convey("When calling getDimensionsForCustomMetrics", t, func() {
		region := "us-east-1"
		namespace := "Foo"
		database := "default"
		assumeRoleArn := ""
		f := func(region string, namespace string, database string, assumeRoleArn string) (cloudwatch.ListMetricsOutput, error) {
			return cloudwatch.ListMetricsOutput{
				Metrics: []*cloudwatch.Metric{
					{
						MetricName: aws.String("Test_MetricName"),
						Dimensions: []*cloudwatch.Dimension{
							{
								Name: aws.String("Test_DimensionName"),
							},
						},
					},
				},
			}, nil
		}
		dimensionKeys, _ := getDimensionsForCustomMetrics(region, namespace, database, assumeRoleArn, f)

		Convey("Should contain Test_DimensionName", func() {
			So(dimensionKeys, ShouldContain, "Test_DimensionName")
		})
	})

}
