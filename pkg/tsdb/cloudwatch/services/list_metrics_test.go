package services

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var metricResponse = []*cloudwatch.Metric{
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-1234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
		},
	},
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-5234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t2.micro")},
			{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg")},
		},
	},
	{
		MetricName: aws.String("CPUUtilization"),
		Namespace:  aws.String("AWS/EC2"),
		Dimensions: []*cloudwatch.Dimension{
			{Name: aws.String("InstanceId"), Value: aws.String("i-64234567890abcdef0")},
			{Name: aws.String("InstanceType"), Value: aws.String("t3.micro")},
			{Name: aws.String("AutoScalingGroupName"), Value: aws.String("my-asg2")},
		},
	},
}

func TestListMetricsService_GetDimensionKeysByDimensionFilter(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionKeysByDimensionFilter(resources.DimensionKeysRequest{
			ResourceRequest: &resources.ResourceRequest{Region: "us-east-1"},
			Namespace:       "AWS/EC2",
			MetricName:      "CPUUtilization",
			DimensionFilter: []*resources.Dimension{
				{Name: "InstanceId", Value: ""},
			},
		})

		require.NoError(t, err)
		assert.Equal(t, []string{"InstanceType", "AutoScalingGroupName"}, resp)
	})
}

func TestListMetricsService_GetDimensionKeysByNamespace(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionKeysByNamespace("AWS/EC2")

		require.NoError(t, err)
		assert.Equal(t, []string{"InstanceId", "InstanceType", "AutoScalingGroupName"}, resp)
	})
}

func TestListMetricsService_GetDimensionValuesByDimensionFilter(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(metricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionValuesByDimensionFilter(resources.DimensionValuesRequest{
			ResourceRequest: &resources.ResourceRequest{Region: "us-east-1"},
			Namespace:       "AWS/EC2",
			MetricName:      "CPUUtilization",
			DimensionKey:    "InstanceId",
			DimensionFilter: []*resources.Dimension{
				{Name: "InstanceId", Value: ""},
			},
		})

		require.NoError(t, err)
		assert.Equal(t, []string{"i-1234567890abcdef0", "i-5234567890abcdef0", "i-64234567890abcdef0"}, resp)
	})
}
