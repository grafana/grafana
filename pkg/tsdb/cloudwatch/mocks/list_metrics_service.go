package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type ListMetricsServiceMock struct {
	mock.Mock
}

func (a *ListMetricsServiceMock) GetDimensionKeysByDimensionFilter(r resources.DimensionKeysRequest) ([]models.ResourceResponse[string], error) {
	args := a.Called(r)

	return args.Get(0).([]models.ResourceResponse[string]), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionValuesByDimensionFilter(r resources.DimensionValuesRequest) ([]models.ResourceResponse[string], error) {
	args := a.Called(r)

	return args.Get(0).([]models.ResourceResponse[string]), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionKeysByNamespace(namespace string) ([]models.ResourceResponse[string], error) {
	args := a.Called(namespace)

	return args.Get(0).([]models.ResourceResponse[string]), args.Error(1)
}

func (a *ListMetricsServiceMock) GetMetricsByNamespace(namespace string) ([]models.ResourceResponse[models.Metric], error) {
	args := a.Called(namespace)

	return args.Get(0).([]models.ResourceResponse[models.Metric]), args.Error(1)
}
