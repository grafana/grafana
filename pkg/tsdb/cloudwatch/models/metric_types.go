package models

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/request"
)

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(*request.DimensionKeysRequest) ([]string, error)
	GetHardCodedDimensionKeysByNamespace(string) ([]string, error)
	GetDimensionKeysByNamespace(string) ([]string, error)
	GetDimensionValuesByDimensionFilter(*request.DimensionValuesRequest) ([]string, error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}
