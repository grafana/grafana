package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type LogsAPI struct {
	mock.Mock
}

func (l *LogsAPI) DescribeLogGroups(_ context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.DescribeLogGroupsOutput), args.Error(1)
}

func (l *LogsAPI) GetLogGroupFields(_ context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, _ ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.GetLogGroupFieldsOutput), args.Error(1)
}

type LogsService struct {
	mock.Mock
}

func (l *LogsService) GetLogGroups(_ context.Context, request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroup]), args.Error(1)
}

func (l *LogsService) GetLogGroupFields(_ context.Context, request resources.LogGroupFieldsRequest) ([]resources.ResourceResponse[resources.LogGroupField], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroupField]), args.Error(1)
}

type MockLogEvents struct {
	mock.Mock
}

func (m *MockLogEvents) StartQuery(context.Context, *cloudwatchlogs.StartQueryInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StartQueryOutput, error) {
	return nil, nil
}

func (m *MockLogEvents) StopQuery(context.Context, *cloudwatchlogs.StopQueryInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StopQueryOutput, error) {
	return nil, nil
}

func (m *MockLogEvents) GetQueryResults(context.Context, *cloudwatchlogs.GetQueryResultsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return nil, nil
}

func (m *MockLogEvents) DescribeLogGroups(context.Context, *cloudwatchlogs.DescribeLogGroupsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return nil, nil
}

func (m *MockLogEvents) GetLogEvents(ctx context.Context, input *cloudwatchlogs.GetLogEventsInput, optFns ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogEventsOutput, error) {
	args := m.Called(ctx, input, optFns)

	return args.Get(0).(*cloudwatchlogs.GetLogEventsOutput), args.Error(1)
}
