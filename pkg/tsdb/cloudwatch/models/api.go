package models

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(resources.DimensionKeysRequest) ([]string, error)
	GetDimensionKeysByNamespace(string) ([]string, error)
	GetDimensionValuesByDimensionFilter(resources.DimensionValuesRequest) ([]string, error)
	GetMetricsByNamespace(namespace string) ([]resources.Metric, error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}
