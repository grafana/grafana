package cloudwatch

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var counter = 1

type cloudWatchFakeClient struct {
}

func (client *cloudWatchFakeClient) GetMetricDataWithContext(ctx aws.Context, input *cloudwatch.GetMetricDataInput, opts ...request.Option) (*cloudwatch.GetMetricDataOutput, error) {
	nextToken := "next"
	res := []*cloudwatch.MetricDataResult{{
		Values: []*float64{aws.Float64(12.3), aws.Float64(23.5)},
	}}
	if counter == 0 {
		nextToken = ""
		res = []*cloudwatch.MetricDataResult{{
			Values: []*float64{aws.Float64(100)},
		}}
	}
	counter--
	return &cloudwatch.GetMetricDataOutput{
		MetricDataResults: res,
		NextToken:         aws.String(nextToken),
	}, nil
}

func TestGetMetricDataExecutorTest(t *testing.T) {
	executor := &CloudWatchExecutor{}
	inputs := &cloudwatch.GetMetricDataInput{MetricDataQueries: []*cloudwatch.MetricDataQuery{}}
	res, err := executor.executeRequest(context.Background(), &cloudWatchFakeClient{}, inputs)
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.Len(t, res[0].MetricDataResults[0].Values, 2)
	assert.Equal(t, 23.5, *res[0].MetricDataResults[0].Values[1])
	assert.Equal(t, 100.0, *res[1].MetricDataResults[0].Values[0])
}
