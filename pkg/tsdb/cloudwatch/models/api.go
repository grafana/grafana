package models

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(resources.DimensionKeysRequest) ([]ResourceResponse[string], error)
	GetDimensionKeysByNamespace(string) ([]ResourceResponse[string], error)
	GetDimensionValuesByDimensionFilter(resources.DimensionValuesRequest) ([]ResourceResponse[string], error)
	GetMetricsByNamespace(namespace string) ([]ResourceResponse[Metric], error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*MetricOutput, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}
