package models

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
)

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(*DimensionKeysRequest) ([]string, error)
	GetHardCodedDimensionKeysByNamespace(string) ([]string, error)
	GetDimensionKeysByNamespace(string) ([]string, error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}
