package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type ListMetricsServiceMock struct {
	mock.Mock
}

func (a *ListMetricsServiceMock) GetDimensionKeysByDimensionFilter(r resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error) {
	args := a.Called(r)

	return args.Get(0).([]resources.ResourceResponse[string]), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionValuesByDimensionFilter(r resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error) {
	args := a.Called(r)

	return args.Get(0).([]resources.ResourceResponse[string]), args.Error(1)
}

func (a *ListMetricsServiceMock) GetMetricsByNamespace(r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error) {
	args := a.Called(r)

	return args.Get(0).([]resources.ResourceResponse[resources.Metric]), args.Error(1)
}
