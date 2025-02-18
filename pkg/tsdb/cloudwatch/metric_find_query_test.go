package cloudwatch

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_InstanceAttributes(t *testing.T) {
	origNewEC2Client := NewEC2Client
	t.Cleanup(func() {
		NewEC2Client = origNewEC2Client
	})

	var cli oldEC2Client

	NewEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return cli
	}

	t.Run("Get instance ID", func(t *testing.T) {
		const instanceID = "i-12345678"
		cli = oldEC2Client{
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

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: &fakeSessionCache{}}, nil
		})

		filterMap := map[string][]string{
			"tag:Environment": {"production"},
		}
		filterJson, err := json.Marshal(filterMap)
		require.NoError(t, err)

		executor := newExecutor(im, log.NewNullLogger())
		resp, err := executor.handleGetEc2InstanceAttribute(
			context.Background(),
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

	t.Run("Get different types", func(t *testing.T) {
		var expectedInt int64 = 3
		var expectedBool = true
		var expectedArn = "arn"
		cli = oldEC2Client{
			reservations: []*ec2.Reservation{
				{
					Instances: []*ec2.Instance{
						{
							AmiLaunchIndex: &expectedInt,
							EbsOptimized:   &expectedBool,
							IamInstanceProfile: &ec2.IamInstanceProfile{
								Arn: &expectedArn,
							},
						},
					},
				},
			},
		}

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: &fakeSessionCache{}}, nil
		})

		executor := newExecutor(im, log.NewNullLogger())

		testcases := []struct {
			name          string
			attributeName string
			expResponse   []suggestData
		}{
			{
				"int field",
				"AmiLaunchIndex",
				[]suggestData{
					{Text: "3", Value: "3", Label: "3"},
				},
			},
			{
				"bool field",
				"EbsOptimized",
				[]suggestData{
					{Text: "true", Value: "true", Label: "true"},
				},
			},
			{
				"nested field",
				"IamInstanceProfile.Arn",
				[]suggestData{
					{Text: expectedArn, Value: expectedArn, Label: expectedArn},
				},
			},
			{
				"nil field",
				"InstanceLifecycle",
				[]suggestData{},
			},
		}
		for _, tc := range testcases {
			t.Run(tc.name, func(t *testing.T) {
				filterMap := map[string][]string{}
				filterJson, err := json.Marshal(filterMap)
				require.NoError(t, err)

				resp, err := executor.handleGetEc2InstanceAttribute(
					context.Background(),
					backend.PluginContext{
						DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
					}, url.Values{
						"region":        []string{"us-east-1"},
						"attributeName": []string{tc.attributeName},
						"filters":       []string{string(filterJson)},
					},
				)
				require.NoError(t, err)
				assert.Equal(t, tc.expResponse, resp)
			})
		}
	})
}

func TestQuery_EBSVolumeIDs(t *testing.T) {
	origNewEC2Client := NewEC2Client
	t.Cleanup(func() {
		NewEC2Client = origNewEC2Client
	})

	var cli oldEC2Client

	NewEC2Client = func(client.ConfigProvider) models.EC2APIProvider {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = oldEC2Client{
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

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: &fakeSessionCache{}}, nil
		})

		executor := newExecutor(im, log.NewNullLogger())
		resp, err := executor.handleGetEbsVolumeIds(
			context.Background(),
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

		im := datasource.NewInstanceManager(func(ctx context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return DataSource{Settings: models.CloudWatchSettings{}, sessions: &fakeSessionCache{}}, nil
		})

		tagMap := map[string][]string{
			"Environment": {"production"},
		}
		tagJson, err := json.Marshal(tagMap)
		require.NoError(t, err)

		executor := newExecutor(im, log.NewNullLogger())
		resp, err := executor.handleGetResourceArns(
			context.Background(),
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
