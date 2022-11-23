package mocks

import (
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type FakeMetricsClient struct {
	mock.Mock
}

func (m *FakeMetricsClient) ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error) {
	args := m.Called(params)
	return args.Get(0).([]resources.MetricResponse), args.Error(1)
}

func (m *FakeMetricsClient) DescribeAlarms(input *cloudwatch.DescribeAlarmsInput) (*cloudwatch.DescribeAlarmsOutput, error) {
	args := m.Called(input)
	return args.Get(0).(*cloudwatch.DescribeAlarmsOutput), args.Error(1)
}

func (m *FakeMetricsClient) DescribeAlarmsForMetric(input *cloudwatch.DescribeAlarmsForMetricInput) (*cloudwatch.DescribeAlarmsForMetricOutput, error) {
	args := m.Called(input)
	return args.Get(0).(*cloudwatch.DescribeAlarmsForMetricOutput), args.Error(1)
}

func (m *FakeMetricsClient) DescribeAlarmHistory(input *cloudwatch.DescribeAlarmHistoryInput) (*cloudwatch.DescribeAlarmHistoryOutput, error) {
	args := m.Called(input)
	return args.Get(0).(*cloudwatch.DescribeAlarmHistoryOutput), args.Error(1)
}

var QueryDataRequest *backend.QueryDataRequest = &backend.QueryDataRequest{
	PluginContext: backend.PluginContext{
		OrgID: 1,
	},
}
