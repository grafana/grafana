package clients

import (
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
)

type metricsClient struct {
	cloudwatchiface.CloudWatchAPI
	config *setting.Cfg
}

func NewMetricsClient(api cloudwatchiface.CloudWatchAPI, config *setting.Cfg) *metricsClient {
	return &metricsClient{CloudWatchAPI: api, config: config}
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
