package mocks

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/mock"
)

type FakeMetricsClient struct {
	mock.Mock
}

func (m *FakeMetricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*models.MetricOutput, error) {
	args := m.Called(params)
	return args.Get(0).([]*models.MetricOutput), args.Error(1)
}
