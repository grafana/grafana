package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
)

func (e *CloudWatchExecutor) executeRequest(ctx context.Context, region string, metricDataInput *cloudwatch.GetMetricDataInput) ([]*cloudwatch.MetricDataResult, error) {
	mdr := make([]*cloudwatch.MetricDataResult, 0)

	client, err := e.getClient(region)
	if err != nil {
		return mdr, err
	}

	nextToken := ""
	for {
		if nextToken != "" {
			metricDataInput.NextToken = aws.String(nextToken)
		}
		resp, err := client.GetMetricDataWithContext(ctx, metricDataInput)
		if err != nil {
			return mdr, err
		}
		mdr = append(mdr, resp.MetricDataResults...)
		metrics.MAwsCloudWatchGetMetricData.Add(float64(len(metricDataInput.MetricDataQueries)))

		if resp.NextToken == nil || *resp.NextToken == "" {
			break
		}
		nextToken = *resp.NextToken
	}

	return mdr, nil
}
