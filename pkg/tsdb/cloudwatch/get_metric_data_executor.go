package cloudwatch

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/features"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

func (ds *DataSource) executeRequest(ctx context.Context, client models.CWClient,
	metricDataInput *cloudwatch.GetMetricDataInput) ([]*cloudwatch.GetMetricDataOutput, error) {
	mdo := make([]*cloudwatch.GetMetricDataOutput, 0)

	nextToken := ""
	for {
		if nextToken != "" {
			metricDataInput.NextToken = aws.String(nextToken)
		}
		// GetMetricData EndTime is exclusive, so we round up to the next minute to get the last data point
		if features.IsEnabled(ctx, features.FlagCloudWatchRoundUpEndTime) {
			*metricDataInput.EndTime = metricDataInput.EndTime.Truncate(time.Minute).Add(time.Minute)
		}

		resp, err := client.GetMetricData(ctx, metricDataInput)
		if err != nil {
			return mdo, backend.DownstreamError(err)
		}

		mdo = append(mdo, resp)
		utils.QueriesTotalCounter.WithLabelValues(utils.GetMetricDataLabel).Add(float64(len(metricDataInput.MetricDataQueries)))
		if resp.NextToken == nil || *resp.NextToken == "" {
			break
		}
		nextToken = *resp.NextToken
	}

	return mdo, nil
}
