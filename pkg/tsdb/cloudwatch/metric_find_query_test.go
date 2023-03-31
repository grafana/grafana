package cloudwatch

import (
	"encoding/json"
	"net/url"
	"sort"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/constants"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestQuery_Regions(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return cli
	}

	t.Run("An extra region", func(t *testing.T) {
		const regionName = "xtra-region"
		cli = fakeEC2Client{
			regions: []string{regionName},
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetRegions(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":    []string{"us-east-1"},
				"namespace": []string{"custom"},
			},
		)
		require.NoError(t, err)

		expRegions := buildSortedSliceOfDefaultAndExtraRegions(t, regionName)
		expFrame := data.NewFrame(
			"",
			data.NewField("text", nil, expRegions),
			data.NewField("value", nil, expRegions),
		)
		expFrame.Meta = &data.FrameMeta{
			Custom: map[string]interface{}{
				"rowCount": len(constants.Regions()) + 1,
			},
		}

		expResponse := []suggestData{}
		for _, region := range expRegions {
			expResponse = append(expResponse, suggestData{Text: region, Value: region, Label: region})
		}
		assert.Equal(t, expResponse, resp)
	})
}

func buildSortedSliceOfDefaultAndExtraRegions(t *testing.T, regionName string) []string {
	t.Helper()
	regions := constants.Regions()
	regions[regionName] = struct{}{}
	var expRegions []string
	for region := range regions {
		expRegions = append(expRegions, region)
	}
	sort.Strings(expRegions)
	return expRegions
}

func Test_handleGetRegions_regionCache(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})
	cli := mockEC2Client{}
	newEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return &cli
	}
	im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return DataSource{Settings: models.CloudWatchSettings{}}, nil
	})

	t.Run("AWS only called once for multiple calls to handleGetRegions", func(t *testing.T) {
		cli.On("DescribeRegions", mock.Anything, mock.Anything).Return(&ec2.DescribeRegionsOutput{}, nil)
		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		_, err := executor.handleGetRegions(
			backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}}, nil)

		_, err = executor.handleGetRegions(
			backend.PluginContext{DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{}}, nil)

		assert.NoError(t, err)
		cli.AssertNumberOfCalls(t, "DescribeRegions", 1)
	})
}

func TestQuery_InstanceAttributes(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return cli
	}

	t.Run("Get instance ID", func(t *testing.T) {
		const instanceID = "i-12345678"
		cli = fakeEC2Client{
			reservations: []*ec2.Reservation{
				{
					Instances: []*ec2.Instance{
						{
							InstanceId: aws.String(instanceID),
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
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		filterMap := map[string][]string{
			"tag:Environment": {"production"},
		}
		filterJson, err := json.Marshal(filterMap)
		require.NoError(t, err)

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetEc2InstanceAttribute(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":        []string{"us-east-1"},
				"attributeName": []string{"InstanceId"},
				"filters":       []string{string(filterJson)},
			},
		)
		require.NoError(t, err)

		expResponse := []suggestData{
			{Text: instanceID, Value: instanceID, Label: instanceID},
		}
		assert.Equal(t, expResponse, resp)
	})
}

func TestQuery_EBSVolumeIDs(t *testing.T) {
	origNewEC2Client := newEC2Client
	t.Cleanup(func() {
		newEC2Client = origNewEC2Client
	})

	var cli fakeEC2Client

	newEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = fakeEC2Client{
			reservations: []*ec2.Reservation{
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
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetEbsVolumeIds(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":     []string{"us-east-1"},
				"instanceId": []string{"{i-1, i-2, i-3}"},
			},
		)
		require.NoError(t, err)

		expValues := []string{"vol-1-1", "vol-1-2", "vol-2-1", "vol-2-2", "vol-3-1", "vol-3-2"}
		expResponse := []suggestData{}
		for _, value := range expValues {
			expResponse = append(expResponse, suggestData{Text: value, Value: value, Label: value})
		}
		assert.Equal(t, expResponse, resp)
	})
}

func TestQuery_ResourceARNs(t *testing.T) {
	origNewRGTAClient := newRGTAClient
	t.Cleanup(func() {
		newRGTAClient = origNewRGTAClient
	})

	var cli fakeRGTAClient

	newRGTAClient = func(client.ConfigProvider) resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = fakeRGTAClient{
			tagMapping: []*resourcegroupstaggingapi.ResourceTagMapping{
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
		}

		im := datasource.NewInstanceManager(func(s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}}, nil
		})

		tagMap := map[string][]string{
			"Environment": {"production"},
		}
		tagJson, err := json.Marshal(tagMap)
		require.NoError(t, err)

		executor := newExecutor(im, newTestConfig(), &fakeSessionCache{}, featuremgmt.WithFeatures())
		resp, err := executor.handleGetResourceArns(
			backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}, url.Values{
				"region":       []string{"us-east-1"},
				"resourceType": []string{"ec2:instance"},
				"tags":         []string{string(tagJson)},
			},
		)
		require.NoError(t, err)

		expValues := []string{
			"arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567",
			"arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321",
		}
		expResponse := []suggestData{}
		for _, value := range expValues {
			expResponse = append(expResponse, suggestData{Text: value, Value: value, Label: value})
		}
		assert.Equal(t, expResponse, resp)
	})
}
