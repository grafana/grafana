package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cloudwatchtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"

	"github.com/stretchr/testify/mock"
)

type FakeMetricsAPI struct {
	models.CWClient

	Metrics        []cloudwatchtypes.Metric
	OwningAccounts []string
	MetricsPerPage int

	cursor int
}

func (c *FakeMetricsAPI) ListMetrics(_ context.Context, _ *cloudwatch.ListMetricsInput, _ ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error) {
	if c.MetricsPerPage == 0 {
		c.MetricsPerPage = 1000
	}
	var metrics []cloudwatchtypes.Metric
	nextToken := aws.String("yes")
	if c.cursor < len(c.Metrics) {
		end := c.cursor + c.MetricsPerPage
		if end > len(c.Metrics) {
			end = len(c.Metrics)
			nextToken = nil
		}
		metrics = c.Metrics[c.cursor:end]
	}
	c.cursor += c.MetricsPerPage

	return &cloudwatch.ListMetricsOutput{
		Metrics:        metrics,
		OwningAccounts: c.OwningAccounts,
		NextToken:      nextToken,
	}, nil
}

type MetricsAPI struct {
	mock.Mock
	models.CWClient

	Metrics []cloudwatchtypes.Metric
}

func (m *MetricsAPI) GetMetricData(ctx context.Context, input *cloudwatch.GetMetricDataInput, optFns ...func(*cloudwatch.Options)) (*cloudwatch.GetMetricDataOutput, error) {
	args := m.Called(ctx, input, optFns)

	return args.Get(0).(*cloudwatch.GetMetricDataOutput), args.Error(1)
}

func (m *MetricsAPI) ListMetrics(_ context.Context, _ *cloudwatch.ListMetricsInput, _ ...func(*cloudwatch.Options)) (*cloudwatch.ListMetricsOutput, error) {
	return &cloudwatch.ListMetricsOutput{
		Metrics: m.Metrics,
	}, m.Called().Error(0)
}
