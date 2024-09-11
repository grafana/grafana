package cloudwatch

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetMetricDataExecutorTestRequest(t *testing.T) {
	t.Run("Should round up end time if cloudWatchRoundUpEndTime is enabled", func(t *testing.T) {
		executor := &cloudWatchExecutor{}
		queryEndTime, _ := time.Parse("2006-01-02T15:04:05Z07:00", "2024-05-01T01:45:04Z")
		inputs := &cloudwatch.GetMetricDataInput{EndTime: &queryEndTime, MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
		mockMetricClient := &mocks.MetricsAPI{}
		mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(
			&cloudwatch.GetMetricDataOutput{
				MetricDataResults: []*cloudwatch.MetricDataResult{{Values: []*float64{}}},
			}, nil).Once()
		_, err := executor.executeRequest(contextWithFeaturesEnabled(features.FlagCloudWatchRoundUpEndTime), mockMetricClient, inputs)
		require.NoError(t, err)
		expectedTime, _ := time.Parse("2006-01-02T15:04:05Z07:00", "2024-05-01T01:46:00Z")
		expectedInput := &cloudwatch.GetMetricDataInput{EndTime: &expectedTime, MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
		mockMetricClient.AssertCalled(t, "GetMetricDataWithContext", mock.Anything, expectedInput, mock.Anything)
	})
}

func TestGetMetricDataExecutorTestResponse(t *testing.T) {
	executor := &cloudWatchExecutor{}
	inputs := &cloudwatch.GetMetricDataInput{EndTime: aws.Time(time.Now()), MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
	mockMetricClient := &mocks.MetricsAPI{}
	mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(
		&cloudwatch.GetMetricDataOutput{
			MetricDataResults: []*cloudwatch.MetricDataResult{{Values: []*float64{aws.Float64(12.3), aws.Float64(23.5)}}},
			NextToken:         aws.String("next"),
		}, nil).Once()
	mockMetricClient.On("GetMetricDataWithContext", mock.Anything, mock.Anything, mock.Anything).Return(
		&cloudwatch.GetMetricDataOutput{
			MetricDataResults: []*cloudwatch.MetricDataResult{{Values: []*float64{aws.Float64(100)}}},
		}, nil).Once()
	res, err := executor.executeRequest(context.Background(), mockMetricClient, inputs)
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.Len(t, res[0].MetricDataResults[0].Values, 2)
	assert.Equal(t, 23.5, *res[0].MetricDataResults[0].Values[1])
	assert.Equal(t, 100.0, *res[1].MetricDataResults[0].Values[0])
}
