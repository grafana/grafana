package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type ListMetricsServiceMock struct {
	mock.Mock
}

func (a *ListMetricsServiceMock) GetDimensionKeysByDimensionFilter(r resources.DimensionKeysRequest) ([]string, error) {
	args := a.Called(r)

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionValuesByDimensionFilter(r resources.DimensionValuesRequest) ([]string, error) {
	args := a.Called(r)

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionKeysByNamespace(namespace string) ([]string, error) {
	args := a.Called(namespace)

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetMetricsByNamespace(namespace string) ([]resources.Metric, error) {
	args := a.Called(namespace)

	return args.Get(0).([]resources.Metric), args.Error(1)
}
