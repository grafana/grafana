package services

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestListMetricsService_GetHardCodedDimensionKeysByNamespace(t *testing.T) {
	t.Run("Should return an error in case namespace doesnt exist in map", func(t *testing.T) {
		listMetricsService := NewListMetricsService(&mocks.FakeMetricsClient{})
		resp, err := listMetricsService.GetHardCodedDimensionKeysByNamespace("unknownNamespace")
		require.Error(t, err)
		assert.Nil(t, resp)
		assert.Equal(t, err.Error(), "unable to find dimensions for namespace '\"unknownNamespace\"'")
	})

	t.Run("Should return keys if namespace exist", func(t *testing.T) {
		listMetricsService := NewListMetricsService(&mocks.FakeMetricsClient{})
		resp, err := listMetricsService.GetHardCodedDimensionKeysByNamespace("AWS/EC2")
		require.NoError(t, err)
		assert.Equal(t, []string{"AutoScalingGroupName", "ImageId", "InstanceId", "InstanceType"}, resp)
	})
}

func TestListMetricsService_GetDimensionKeysByDimensionFilter(t *testing.T) {
	t.Run("Should filter out duplicates and keys matching dimension filter keys", func(t *testing.T) {
		fakeMetricsClient := &mocks.FakeMetricsClient{}
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(mocks.MetricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionKeysByDimensionFilter(&models.DimensionKeysQuery{
			Region:     "us-east-1",
			Namespace:  "AWS/EC2",
			MetricName: "CPUUtilization",
			DimensionFilter: []*models.Dimension{
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
		fakeMetricsClient.On("ListMetricsWithPageLimit", mock.Anything).Return(mocks.MetricResponse, nil)
		listMetricsService := NewListMetricsService(fakeMetricsClient)

		resp, err := listMetricsService.GetDimensionKeysByNamespace("AWS/EC2")

		require.NoError(t, err)
		assert.Equal(t, []string{"InstanceId", "InstanceType", "AutoScalingGroupName"}, resp)
	})
}
