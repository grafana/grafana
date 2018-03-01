package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/bmizerany/assert"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

type mockedEc2 struct {
	ec2iface.EC2API
	Resp ec2.DescribeInstancesOutput
}

func (m mockedEc2) DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}

func TestCloudWatchMetrics(t *testing.T) {

	Convey("When calling getMetricsForCustomMetrics", t, func() {
		dsInfo := &DatasourceInfo{
			Region:        "us-east-1",
			Namespace:     "Foo",
			Profile:       "default",
			AssumeRoleArn: "",
		}
		f := func(dsInfo *DatasourceInfo) (cloudwatch.ListMetricsOutput, error) {
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
		metrics, _ := getMetricsForCustomMetrics(dsInfo, f)

		Convey("Should contain Test_MetricName", func() {
			So(metrics, ShouldContain, "Test_MetricName")
		})
	})

	Convey("When calling getDimensionsForCustomMetrics", t, func() {
		dsInfo := &DatasourceInfo{
			Region:        "us-east-1",
			Namespace:     "Foo",
			Profile:       "default",
			AssumeRoleArn: "",
		}
		f := func(dsInfo *DatasourceInfo) (cloudwatch.ListMetricsOutput, error) {
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
		dimensionKeys, _ := getDimensionsForCustomMetrics(dsInfo, f)

		Convey("Should contain Test_DimensionName", func() {
			So(dimensionKeys, ShouldContain, "Test_DimensionName")
		})
	})

	Convey("When calling handleGetEc2InstanceAttribute", t, func() {
		executor := &CloudWatchExecutor{
			ec2Svc: mockedEc2{Resp: ec2.DescribeInstancesOutput{
				Reservations: []*ec2.Reservation{
					{
						Instances: []*ec2.Instance{
							{
								InstanceId: aws.String("i-12345678"),
								Tags: []*ec2.Tag{
									{
										Key:   aws.String("Environment"),
										Value: aws.String("production"),
									},
								},
							},
						},
					},
				},
			}},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("attributeName", "InstanceId")
		filters := make(map[string]interface{})
		filters["tag:Environment"] = []string{"production"}
		json.Set("filters", filters)
		result, _ := executor.handleGetEc2InstanceAttribute(context.Background(), json, &tsdb.TsdbQuery{})

		Convey("Should equal production InstanceId", func() {
			So(result[0].Text, ShouldEqual, "i-12345678")
		})
	})

	Convey("When calling handleGetEbsVolumeIds", t, func() {

		executor := &CloudWatchExecutor{
			ec2Svc: mockedEc2{Resp: ec2.DescribeInstancesOutput{
				Reservations: []*ec2.Reservation{
					{
						Instances: []*ec2.Instance{
							{
								InstanceId: aws.String("i-1"),
								BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-1")}},
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-2")}},
								},
							},
							{
								InstanceId: aws.String("i-2"),
								BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-1")}},
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-2")}},
								},
							},
						},
					},
					{
						Instances: []*ec2.Instance{
							{
								InstanceId: aws.String("i-3"),
								BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-1")}},
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-2")}},
								},
							},
							{
								InstanceId: aws.String("i-4"),
								BlockDeviceMappings: []*ec2.InstanceBlockDeviceMapping{
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-1")}},
									{Ebs: &ec2.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-2")}},
								},
							},
						},
					},
				},
			}},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("instanceId", "{i-1, i-2, i-3, i-4}")
		result, _ := executor.handleGetEbsVolumeIds(context.Background(), json, &tsdb.TsdbQuery{})

		Convey("Should return all 8 VolumeIds", func() {
			So(len(result), ShouldEqual, 8)
			So(result[0].Text, ShouldEqual, "vol-1-1")
			So(result[1].Text, ShouldEqual, "vol-1-2")
			So(result[2].Text, ShouldEqual, "vol-2-1")
			So(result[3].Text, ShouldEqual, "vol-2-2")
			So(result[4].Text, ShouldEqual, "vol-3-1")
			So(result[5].Text, ShouldEqual, "vol-3-2")
			So(result[6].Text, ShouldEqual, "vol-4-1")
			So(result[7].Text, ShouldEqual, "vol-4-2")
		})
	})
}

func TestParseMultiSelectValue(t *testing.T) {

	var values []string

	values = parseMultiSelectValue(" i-someInstance ")
	assert.Equal(t, []string{"i-someInstance"}, values)

	values = parseMultiSelectValue("{i-05}")
	assert.Equal(t, []string{"i-05"}, values)

	values = parseMultiSelectValue(" {i-01, i-03, i-04} ")
	assert.Equal(t, []string{"i-01", "i-03", "i-04"}, values)

	values = parseMultiSelectValue("i-{01}")
	assert.Equal(t, []string{"i-{01}"}, values)

}
