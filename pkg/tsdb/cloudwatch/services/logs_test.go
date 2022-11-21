package services

import (
	"fmt"
	"testing"

	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func Test_GetLogGroups(t *testing.T) {
	t.Run("Should map log groups response", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(
			&cloudwatchlogs.DescribeLogGroupsOutput{
				LogGroups: []*cloudwatchlogs.LogGroup{
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: utils.Pointer("group_a")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: utils.Pointer("group_b")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:333:log-group:group_c"), LogGroupName: utils.Pointer("group_c")},
				},
			}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		resp, err := service.GetLogGroups(resources.LogGroupsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: utils.Pointer("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
			{
				AccountId: utils.Pointer("222"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:222:log-group:group_b", Name: "group_b"},
			},
			{
				AccountId: utils.Pointer("333"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:333:log-group:group_c", Name: "group_c"},
			},
		}, resp)
	})

	t.Run("Should only use LogGroupNamePrefix even if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		// TODO: use LogGroupNamePattern when we have accounted for its behavior, still a little unexpected at the moment
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			Limit:              0,
			LogGroupNamePrefix: utils.Pointer("test"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              utils.Pointer(int64(0)),
			LogGroupNamePrefix: utils.Pointer("test"),
		})
	})

	t.Run("Should call api without LogGroupNamePrefix nor LogGroupNamePattern if not passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit: utils.Pointer(int64(0)),
		})
	})

	t.Run("Should return an error when API returns error", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{},
			fmt.Errorf("some error"))
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{})

		assert.Error(t, err)
		assert.Equal(t, "some error", err.Error())
	})
}

func Test_GetLogGroups_crossAccountQuerying(t *testing.T) {
	t.Run("Should not includeLinkedAccounts or accountId if isCrossAccountEnabled is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              utils.Pointer(int64(0)),
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
	})

	t.Run("Should replace LogGroupNamePrefix if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			ResourceRequest:     resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix:  utils.Pointer("prefix"),
			LogGroupNamePattern: utils.Pointer("pattern"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []*string{utils.Pointer("accountId")},
			Limit:                 utils.Pointer(int64(0)),
			LogGroupNamePrefix:    utils.Pointer("pattern"),
			IncludeLinkedAccounts: utils.Pointer(true),
		})
	})

	t.Run("Should includeLinkedAccounts,and accountId if isCrossAccountEnabled is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:                 utils.Pointer(int64(0)),
			IncludeLinkedAccounts: utils.Pointer(true),
			AccountIdentifiers:    []*string{utils.Pointer("accountId")},
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []*string{utils.Pointer("accountId")},
			Limit:                 utils.Pointer(int64(0)),
			LogGroupNamePrefix:    utils.Pointer("prefix"),
			IncludeLinkedAccounts: utils.Pointer(true),
		})
	})

	t.Run("Should not includeLinkedAccounts, or accountId if accountId is nil", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              utils.Pointer(int64(0)),
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{
				AccountId: utils.Pointer("accountId"),
			},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []*string{utils.Pointer("accountId")},
			IncludeLinkedAccounts: utils.Pointer(true),
			Limit:                 utils.Pointer(int64(0)),
			LogGroupNamePrefix:    utils.Pointer("prefix"),
		})
	})
}
