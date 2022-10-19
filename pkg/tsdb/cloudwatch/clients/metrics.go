package clients

import (
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type metricsClient struct {
	models.CloudWatchMetricsAPIProvider
	config *setting.Cfg
}

func NewMetricsClient(api models.CloudWatchMetricsAPIProvider, config *setting.Cfg) *metricsClient {
	return &metricsClient{CloudWatchMetricsAPIProvider: api, config: config}
}

func (l *metricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error) {
	var cloudWatchMetrics []*cloudwatch.Metric
	pageNum := 0
	err := l.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		metrics.MAwsCloudWatchListMetrics.Inc()
		metrics, err := awsutil.ValuesAtPath(page, "Metrics")
		if err == nil {
			for _, metric := range metrics {
				cloudWatchMetrics = append(cloudWatchMetrics, metric.(*cloudwatch.Metric))
			}
		}
		return !lastPage && pageNum < l.config.AWSListMetricsPageLimit
	})

	return cloudWatchMetrics, err
}
