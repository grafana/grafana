package mocks

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/stretchr/testify/mock"
)

type FakeMetricsClient struct {
	mock.Mock
}

func (m *FakeMetricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]*cloudwatch.Metric, error) {
	args := m.Called(params)
	return args.Get(0).([]*cloudwatch.Metric), args.Error(1)
}
