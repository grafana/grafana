package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/request"
	"github.com/stretchr/testify/mock"
)

type ListMetricsServiceMock struct {
	mock.Mock
}

func (a *ListMetricsServiceMock) GetDimensionKeysByDimensionFilter(*request.DimensionKeysRequest) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionValuesByDimensionFilter(r *request.DimensionValuesRequest) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionKeysByNamespace(string) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetMetricsByNamespace(namespace string) ([]models.Metric, error) {
	args := a.Called()

	return args.Get(0).([]models.Metric), args.Error(1)
}
