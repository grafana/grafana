package services

import (
	"github.com/grafana/grafana-aws-sdk/pkg/cloudWatchConsts"
)

// init extends the SDK's NamespaceMetricsMap with additional metrics
// that may not be available in the current SDK version.
// This allows Grafana to support new CloudWatch metrics without waiting
// for SDK releases.
func init() {
	extendBedrockMetrics()
}

// extendBedrockMetrics adds additional AWS/Bedrock metrics that are not
// yet available in the grafana-aws-sdk package.
func extendBedrockMetrics() {
	bedrockMetrics := cloudWatchConsts.NamespaceMetricsMap["AWS/Bedrock"]
	if bedrockMetrics == nil {
		return
	}

	additionalMetrics := []string{
		"CacheWriteInputTokenCount",
		"CacheWriteOutputTokenCount",
	}

	for _, metric := range additionalMetrics {
		if !containsMetric(bedrockMetrics, metric) {
			cloudWatchConsts.NamespaceMetricsMap["AWS/Bedrock"] = append(
				cloudWatchConsts.NamespaceMetricsMap["AWS/Bedrock"],
				metric,
			)
		}
	}
}

func containsMetric(metrics []string, metric string) bool {
	for _, m := range metrics {
		if m == metric {
			return true
		}
	}
	return false
}
