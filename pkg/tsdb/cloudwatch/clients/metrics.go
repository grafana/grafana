package clients

import (
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/request"
)

type metricsClient struct {
	models.CloudWatchMetricsAPIProvider
	config *setting.Cfg
}

func NewMetricsClient(api models.CloudWatchMetricsAPIProvider, config *setting.Cfg) *metricsClient {
	return &metricsClient{CloudWatchMetricsAPIProvider: api, config: config}
}

func (l *metricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*models.MetricOutput, error) {
	var cloudWatchMetrics []*models.MetricOutput
	pageNum := 0
	err := l.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		metrics.MAwsCloudWatchListMetrics.Inc()
		metrics, err := awsutil.ValuesAtPath(page, "Metrics")
		if err == nil {
			for idx, metric := range metrics {
				metric := &models.MetricOutput{Metric: metric.(*cloudwatch.Metric)}
				if len(page.OwningAccounts) >= idx && params.IncludeLinkedAccounts != nil && *params.IncludeLinkedAccounts {
					metric.Account = &request.Account{
						Id: *page.OwningAccounts[idx],
					}
				}
				cloudWatchMetrics = append(cloudWatchMetrics, metric)
			}
		}
		return !lastPage && pageNum < l.config.AWSListMetricsPageLimit
	})

	return cloudWatchMetrics, err
}
