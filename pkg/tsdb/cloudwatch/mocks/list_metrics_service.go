package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/mock"
)

type ListMetricsServiceMock struct {
	mock.Mock
}

func (a *ListMetricsServiceMock) GetDimensionKeysByDimensionFilter(*models.DimensionKeysRequest) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetDimensionKeysByNamespace(string) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}

func (a *ListMetricsServiceMock) GetHardCodedDimensionKeysByNamespace(string) ([]string, error) {
	args := a.Called()

	return args.Get(0).([]string), args.Error(1)
}
