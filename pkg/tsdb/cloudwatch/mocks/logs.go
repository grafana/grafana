package mocks

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type LogsAPI struct {
	mock.Mock
}

func (l *LogsAPI) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.DescribeLogGroupsOutput), args.Error(1)
}

func (l *LogsAPI) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.GetLogGroupFieldsOutput), args.Error(1)
}

type LogsService struct {
	mock.Mock
}

func (l *LogsService) GetLogGroupsWithContext(ctx context.Context, request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroup]), args.Error(1)
}

func (l *LogsService) GetLogGroupFieldsWithContext(ctx context.Context, request resources.LogGroupFieldsRequest, option ...request.Option) ([]resources.ResourceResponse[resources.LogGroupField], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroupField]), args.Error(1)
}

type MockLogEvents struct {
	cloudwatchlogsiface.CloudWatchLogsAPI

	mock.Mock
}

func (m *MockLogEvents) GetLogEventsWithContext(ctx aws.Context, input *cloudwatchlogs.GetLogEventsInput, option ...request.Option) (*cloudwatchlogs.GetLogEventsOutput, error) {
	args := m.Called(ctx, input, option)

	return args.Get(0).(*cloudwatchlogs.GetLogEventsOutput), args.Error(1)
}
