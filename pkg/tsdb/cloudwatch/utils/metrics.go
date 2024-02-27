package utils

import (
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
