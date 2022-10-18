package clients

import (
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
)

type metricsClient struct {
	metricsPagesLister metricsPagesLister
	config             *setting.Cfg
}

type metricsPagesLister interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}

func NewMetricsClient(api metricsPagesLister, config *setting.Cfg) *metricsClient {
	return &metricsClient{metricsPagesLister: api, config: config}
}

func (c *metricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error) {
	var cloudWatchMetrics []*cloudwatch.Metric
	pageNum := 0
	err := c.metricsPagesLister.ListMetricsPages(params, func(page *cloudwatch.ListMetricsOutput, lastPage bool) bool {
		pageNum++
		metrics.MAwsCloudWatchListMetrics.Inc()
		metricsValues, err := awsutil.ValuesAtPath(page, "Metrics")
		if err == nil {
			for _, metric := range metricsValues {
				cloudWatchMetrics = append(cloudWatchMetrics, metric.(*cloudwatch.Metric))
			}
		}
		return !lastPage && pageNum < c.config.AWSListMetricsPageLimit
	})

	return cloudWatchMetrics, err
}
