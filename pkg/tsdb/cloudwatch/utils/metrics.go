package utils

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	// Labels for the metric counter query types

	ListMetricsLabel   = "list_metrics"
	GetMetricDataLabel = "get_metric_data"
)

var QueriesTotalCounter = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana_plugin",
		Name:      "aws_cloudwatch_queries_total",
		Help:      "Counter for AWS Queries",
	},
	[]string{"query_type"},
)

// BatchDataQueriesByTimeRange separates the passed in queries into batches based on time ranges
func BatchDataQueriesByTimeRange(queries []backend.DataQuery) [][]backend.DataQuery {
	timeToBatch := make(map[backend.TimeRange][]backend.DataQuery)

	for _, query := range queries {
		key := backend.TimeRange{From: query.TimeRange.From.UTC(), To: query.TimeRange.To.UTC()}
		timeToBatch[key] = append(timeToBatch[key], query)
	}

	finalBatches := [][]backend.DataQuery{}
	for _, batch := range timeToBatch {
		finalBatches = append(finalBatches, batch)
	}
	return finalBatches
}
