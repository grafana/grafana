package services

import (
	"fmt"
	"testing"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func Test_GetLogGroups(t *testing.T) {
	t.Run("Should map log groups response", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(
			&cloudwatchlogs.DescribeLogGroupsOutput{
				LogGroups: []*cloudwatchlogs.LogGroup{
					{Arn: pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: pointer("group_a")},
					{Arn: pointer("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: pointer("group_b")},
					{Arn: pointer("arn:aws:logs:us-east-1:333:log-group:group_c"), LogGroupName: pointer("group_c")},
				},
			}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		resp, err := service.GetLogGroups(resources.LogsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: pointer("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
			{
				AccountId: pointer("222"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:222:log-group:group_b", Name: "group_b"},
			},
			{
				AccountId: pointer("333"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:333:log-group:group_c", Name: "group_c"},
			},
		}, resp)
	})

	t.Run("Should only use LogGroupNamePrefix even if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		// TODO: use LogGroupNamePattern when we have accounted for its behavior, still a little unexpected at the moment
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{
			LogGroupNamePrefix:  pointer("prefix"),
			LogGroupNamePattern: pointer("pattern"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              pointer(int64(0)),
			LogGroupNamePrefix: pointer("prefix"),
		})
	})

	t.Run("Should call api without LogGroupNamePrefix nor LogGroupNamePattern if not passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit: pointer(int64(0)),
		})
	})

	t.Run("Should return an error when API returns error", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{},
			fmt.Errorf("some error"))
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{})

		assert.Error(t, err)
		assert.Equal(t, "some error", err.Error())
	})
}

func Test_GetLogGroups_crossAccountQuerying(t *testing.T) {
	t.Run("Should not includeLinkedAccounts or accountId if isCrossAccountEnabled is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{
			AccountId:                     pointer("accountId"),
			LogGroupNamePrefix:            pointer("prefix"),
			IsCrossAccountQueryingEnabled: false,
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              pointer(int64(0)),
			LogGroupNamePrefix: pointer("prefix"),
		})
	})

	t.Run("Should replace LogGroupNamePrefix if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{
			AccountId:                     pointer("accountId"),
			LogGroupNamePrefix:            pointer("prefix"),
			LogGroupNamePattern:           pointer("pattern"),
			IsCrossAccountQueryingEnabled: true,
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []*string{pointer("accountId")},
			Limit:                 pointer(int64(0)),
			LogGroupNamePrefix:    pointer("pattern"),
			IncludeLinkedAccounts: pointer(true),
		})
	})

	t.Run("Should includeLinkedAccounts,and accountId if isCrossAccountEnabled is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{
			AccountId:                     pointer("accountId"),
			IsCrossAccountQueryingEnabled: true,
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:                 pointer(int64(0)),
			IncludeLinkedAccounts: pointer(true),
			AccountIdentifiers:    []*string{pointer("accountId")},
		})
	})

	t.Run("Should not includeLinkedAccounts, or accountId if accountId is nil", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI)

		_, err := service.GetLogGroups(resources.LogsRequest{
			LogGroupNamePrefix:            pointer("prefix"),
			IsCrossAccountQueryingEnabled: true,
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              pointer(int64(0)),
			LogGroupNamePrefix: pointer("prefix"),
		})
	})
}
