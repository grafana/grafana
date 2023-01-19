package clients

import (
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

// this client wraps the CloudWatch API and handles pagination and the composition of the MetricResponse DTO
type metricsClient struct {
	models.CloudWatchMetricsAPIProvider
	config *setting.Cfg
}

func NewMetricsClient(api models.CloudWatchMetricsAPIProvider, config *setting.Cfg) *metricsClient {
	return &metricsClient{CloudWatchMetricsAPIProvider: api, config: config}
}

func (l *metricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error) {
	var cloudWatchMetrics []resources.MetricResponse
	pageNum := 0
	err := l.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		metrics.MAwsCloudWatchListMetrics.Inc()
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
		return !lastPage && pageNum < l.config.AWSListMetricsPageLimit
	})

	return cloudWatchMetrics, err
}
