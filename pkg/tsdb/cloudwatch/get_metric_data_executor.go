package cloudwatch

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
)

func (e *CloudWatchExecutor) executeRequest(ctx context.Context, client cloudWatchClient, metricDataInput *cloudwatch.GetMetricDataInput) ([]*cloudwatch.GetMetricDataOutput, error) {
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

		for _, message := range resp.Messages {
			if *message.Code == "MaxMetricsExceeded" {
				return mdo, fmt.Errorf("cloudwatch GetMetricData error: Maximum number of allowed metrics exceeded. Please provide a more narrow search")
			}
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
