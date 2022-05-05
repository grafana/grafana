package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/grafana/grafana/pkg/infra/metrics"
)

func (e *cloudWatchExecutor) executeRequest(ctx context.Context, client cloudwatchiface.CloudWatchAPI,
	metricDataInput *cloudwatch.GetMetricDataInput) ([]*cloudwatch.GetMetricDataOutput, error) {
	mdo := make([]*cloudwatch.GetMetricDataOutput, 0)

	nextToken := ""
	for {
		if nextToken != "" {
			metricDataInput.NextToken = aws.String(nextToken)
		}
		resp, err := client.GetMetricDataWithContext(ctx, metricDataInput)
		if err != nil {
			return mdo, err
		}

		mdo = append(mdo, resp)
		metrics.MAwsCloudWatchGetMetricData.Add(float64(len(metricDataInput.MetricDataQueries)))

		if resp.NextToken == nil || *resp.NextToken == "" {
			break
		}
		nextToken = *resp.NextToken
	}

	return mdo, nil
}
