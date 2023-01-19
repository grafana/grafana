package mocks

import (
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type LogsAPI struct {
	mock.Mock
}

func (l *LogsAPI) DescribeLogGroups(input *cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.DescribeLogGroupsOutput), args.Error(1)
}

func (l *LogsAPI) GetLogGroupFields(input *cloudwatchlogs.GetLogGroupFieldsInput) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.GetLogGroupFieldsOutput), args.Error(1)
}

type LogsService struct {
	mock.Mock
}

func (l *LogsService) GetLogGroups(request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroup]), args.Error(1)
}

func (l *LogsService) GetLogGroupFields(request resources.LogGroupFieldsRequest) ([]resources.ResourceResponse[resources.LogGroupField], error) {
	args := l.Called(request)

	return args.Get(0).([]resources.ResourceResponse[resources.LogGroupField]), args.Error(1)
}

type MockFeatures struct {
	mock.Mock
}

func (f *MockFeatures) IsEnabled(feature string) bool {
	args := f.Called(feature)

	return args.Bool(0)
}
