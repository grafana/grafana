package clients

import (
	"context"

	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

// this client wraps the CloudWatch API and handles pagination and the composition of the MetricResponse DTO
type metricsClient struct {
	models.CloudWatchMetricsAPIProvider
	listMetricsPageLimit int
}

func NewMetricsClient(api models.CloudWatchMetricsAPIProvider, pageLimit int) *metricsClient {
	return &metricsClient{CloudWatchMetricsAPIProvider: api, listMetricsPageLimit: pageLimit}
}

func (l *metricsClient) ListMetricsWithPageLimit(ctx context.Context, params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error) {
	var cloudWatchMetrics []resources.MetricResponse
	pageNum := 0
	err := l.ListMetricsPagesWithContext(ctx, params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		utils.QueriesTotalCounter.WithLabelValues(utils.ListMetricsLabel).Inc()
		metrics, err := awsutil.ValuesAtPath(page, "Metrics")
		if err == nil {
			for idx, metric := range metrics {
				metric := resources.MetricResponse{Metric: metric.(*cloudwatch.Metric)}
				if len(page.OwningAccounts) >= idx && params.IncludeLinkedAccounts != nil && *params.IncludeLinkedAccounts {
					metric.AccountId = page.OwningAccounts[idx]
				}
				cloudWatchMetrics = append(cloudWatchMetrics, metric)
			}
		}
		return !lastPage && pageNum < l.listMetricsPageLimit
	})

	return cloudWatchMetrics, err
}
