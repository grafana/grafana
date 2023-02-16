package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetMetricDataExecutorTest(t *testing.T) {
	executor := &cloudWatchExecutor{}
	inputs := &cloudwatch.GetMetricDataInput{MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
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
