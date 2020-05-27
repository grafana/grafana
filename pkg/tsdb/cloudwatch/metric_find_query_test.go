package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockedEc2 struct {
	ec2iface.EC2API
	Resp        ec2.DescribeInstancesOutput
	RespRegions ec2.DescribeRegionsOutput
}

type mockedRGTA struct {
	resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
	Resp resourcegroupstaggingapi.GetResourcesOutput
}

func (m mockedEc2) DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}
func (m mockedEc2) DescribeRegions(in *ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error) {
	return &m.RespRegions, nil
}

func (m mockedRGTA) GetResourcesPages(in *resourcegroupstaggingapi.GetResourcesInput, fn func(*resourcegroupstaggingapi.GetResourcesOutput, bool) bool) error {
	fn(&m.Resp, true)
	return nil
}

func TestCloudWatchMetrics(t *testing.T) {

	t.Run("When calling getMetricsForCustomMetrics", func(t *testing.T) {
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
		metrics, err := getMetricsForCustomMetrics(dsInfo, f)
		require.NoError(t, err)

		assert.Contains(t, metrics, "Test_MetricName")
	})

	t.Run("When calling getDimensionsForCustomMetrics", func(t *testing.T) {
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
		dimensionKeys, err := getDimensionsForCustomMetrics(dsInfo, f)
		require.NoError(t, err)

		assert.Contains(t, dimensionKeys, "Test_DimensionName")
	})

	t.Run("When calling handleGetRegions", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			ec2Svc: mockedEc2{RespRegions: ec2.DescribeRegionsOutput{
				Regions: []*ec2.Region{
					{
						RegionName: aws.String("ap-northeast-2"),
					},
				},
			}},
		}
		jsonData := simplejson.New()
		jsonData.Set("defaultRegion", "default")
		executor.DataSource = &models.DataSource{
			JsonData:       jsonData,
			SecureJsonData: securejsondata.SecureJsonData{},
		}

		result, err := executor.handleGetRegions(context.Background(), simplejson.New(), &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "ap-east-1", result[0].Text)
		assert.Equal(t, "ap-northeast-1", result[1].Text)
		assert.Equal(t, "ap-northeast-2", result[2].Text)
	})

	t.Run("When calling handleGetEc2InstanceAttribute", func(t *testing.T) {
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
		result, err := executor.handleGetEc2InstanceAttribute(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "i-12345678", result[0].Text)
	})

	t.Run("When calling handleGetEbsVolumeIds", func(t *testing.T) {
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
		result, err := executor.handleGetEbsVolumeIds(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		require.Len(t, result, 8)
		assert.Equal(t, "vol-1-1", result[0].Text)
		assert.Equal(t, "vol-1-2", result[1].Text)
		assert.Equal(t, "vol-2-1", result[2].Text)
		assert.Equal(t, "vol-2-2", result[3].Text)
		assert.Equal(t, "vol-3-1", result[4].Text)
		assert.Equal(t, "vol-3-2", result[5].Text)
		assert.Equal(t, "vol-4-1", result[6].Text)
		assert.Equal(t, "vol-4-2", result[7].Text)
	})

	t.Run("When calling handleGetResourceArns", func(t *testing.T) {
		executor := &CloudWatchExecutor{
			rgtaSvc: mockedRGTA{
				Resp: resourcegroupstaggingapi.GetResourcesOutput{
					ResourceTagMappingList: []*resourcegroupstaggingapi.ResourceTagMapping{
						{
							ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567"),
							Tags: []*resourcegroupstaggingapi.Tag{
								{
									Key:   aws.String("Environment"),
									Value: aws.String("production"),
								},
							},
						},
						{
							ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321"),
							Tags: []*resourcegroupstaggingapi.Tag{
								{
									Key:   aws.String("Environment"),
									Value: aws.String("production"),
								},
							},
						},
					},
				},
			},
		}

		json := simplejson.New()
		json.Set("region", "us-east-1")
		json.Set("resourceType", "ec2:instance")
		tags := make(map[string]interface{})
		tags["Environment"] = []string{"production"}
		json.Set("tags", tags)
		result, err := executor.handleGetResourceArns(context.Background(), json, &tsdb.TsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567", result[0].Text)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567", result[0].Value)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321", result[1].Text)
		assert.Equal(t, "arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321", result[1].Value)
	})
}

func TestParseMultiSelectValue(t *testing.T) {
	values := parseMultiSelectValue(" i-someInstance ")
	assert.Equal(t, []string{"i-someInstance"}, values)

	values = parseMultiSelectValue("{i-05}")
	assert.Equal(t, []string{"i-05"}, values)

	values = parseMultiSelectValue(" {i-01, i-03, i-04} ")
	assert.Equal(t, []string{"i-01", "i-03", "i-04"}, values)

	values = parseMultiSelectValue("i-{01}")
	assert.Equal(t, []string{"i-{01}"}, values)
}
