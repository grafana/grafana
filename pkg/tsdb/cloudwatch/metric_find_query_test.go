package cloudwatch

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi"
	resourcegroupstaggingapitypes "github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQuery_InstanceAttributes(t *testing.T) {
	origNewEC2API := NewEC2API
	t.Cleanup(func() {
		NewEC2API = origNewEC2API
	})

	var cli oldEC2Client

	NewEC2API = func(aws.Config) models.EC2APIProvider {
		return cli
	}

	t.Run("Get instance ID", func(t *testing.T) {
		const instanceID = "i-12345678"
		cli = oldEC2Client{
			reservations: []ec2types.Reservation{
				{
					Instances: []ec2types.Instance{
						{
							InstanceId: aws.String(instanceID),
							Tags: []ec2types.Tag{
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

		filterMap := map[string][]string{
			"tag:Environment": {"production"},
		}
		filterJson, err := json.Marshal(filterMap)
		require.NoError(t, err)

		ds := newTestDatasource()
		resp, err := ds.handleGetEc2InstanceAttribute(
			context.Background(),
			url.Values{
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
		var expectedInt int32 = 3
		var expectedBool = true
		var expectedArn = "arn"
		cli = oldEC2Client{
			reservations: []ec2types.Reservation{
				{
					Instances: []ec2types.Instance{
						{
							AmiLaunchIndex: &expectedInt,
							EbsOptimized:   &expectedBool,
							IamInstanceProfile: &ec2types.IamInstanceProfile{
								Arn: &expectedArn,
							},
						},
					},
				},
			},
		}

		ds := newTestDatasource()

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

				resp, err := ds.handleGetEc2InstanceAttribute(
					context.Background(),
					url.Values{
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
	origNewEC2API := NewEC2API
	t.Cleanup(func() {
		NewEC2API = origNewEC2API
	})

	var cli oldEC2Client

	NewEC2API = func(aws.Config) models.EC2APIProvider {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = oldEC2Client{
			reservations: []ec2types.Reservation{
				{
					Instances: []ec2types.Instance{
						{
							InstanceId: aws.String("i-1"),
							BlockDeviceMappings: []ec2types.InstanceBlockDeviceMapping{
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-1")}},
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-1-2")}},
							},
						},
						{
							InstanceId: aws.String("i-2"),
							BlockDeviceMappings: []ec2types.InstanceBlockDeviceMapping{
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-1")}},
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-2-2")}},
							},
						},
					},
				},
				{
					Instances: []ec2types.Instance{
						{
							InstanceId: aws.String("i-3"),
							BlockDeviceMappings: []ec2types.InstanceBlockDeviceMapping{
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-1")}},
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-3-2")}},
							},
						},
						{
							InstanceId: aws.String("i-4"),
							BlockDeviceMappings: []ec2types.InstanceBlockDeviceMapping{
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-1")}},
								{Ebs: &ec2types.EbsInstanceBlockDevice{VolumeId: aws.String("vol-4-2")}},
							},
						},
					},
				},
			},
		}

		ds := newTestDatasource()
		resp, err := ds.handleGetEbsVolumeIds(
			context.Background(),
			url.Values{
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
	origNewRGTAClient := NewRGTAClient
	t.Cleanup(func() {
		NewRGTAClient = origNewRGTAClient
	})

	var cli fakeRGTAClient

	NewRGTAClient = func(aws.Config) resourcegroupstaggingapi.GetResourcesAPIClient {
		return cli
	}

	t.Run("", func(t *testing.T) {
		cli = fakeRGTAClient{
			tagMapping: []resourcegroupstaggingapitypes.ResourceTagMapping{
				{
					ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567"),
					Tags: []resourcegroupstaggingapitypes.Tag{
						{
							Key:   aws.String("Environment"),
							Value: aws.String("production"),
						},
					},
				},
				{
					ResourceARN: aws.String("arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321"),
					Tags: []resourcegroupstaggingapitypes.Tag{
						{
							Key:   aws.String("Environment"),
							Value: aws.String("production"),
						},
					},
				},
			},
		}

		tagMap := map[string][]string{
			"Environment": {"production"},
		}
		tagJson, err := json.Marshal(tagMap)
		require.NoError(t, err)

		ds := newTestDatasource()
		resp, err := ds.handleGetResourceArns(
			context.Background(),
			url.Values{
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
