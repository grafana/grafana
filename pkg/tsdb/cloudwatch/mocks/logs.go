package mocks

import (
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/stretchr/testify/mock"
)

type LogsAPI struct {
	mock.Mock
}

func (l *LogsAPI) DescribeLogGroups(input *cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	args := l.Called(input)

	return args.Get(0).(*cloudwatchlogs.DescribeLogGroupsOutput), args.Error(1)
}
