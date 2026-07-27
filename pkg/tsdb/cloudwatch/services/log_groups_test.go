package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestGetLogGroups(t *testing.T) {
	t.Run("Should map log groups response", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(
			&cloudwatchlogs.DescribeLogGroupsOutput{
				LogGroups: []cloudwatchlogstypes.LogGroup{
					{Arn: new("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: new("group_a")},
					{Arn: new("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: new("group_b")},
					{Arn: new("arn:aws:logs:us-east-1:333:log-group:group_c"), LogGroupName: new("group_c")},
				},
			}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		results, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: new("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
			{
				AccountId: new("222"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:222:log-group:group_b", Name: "group_b"},
			},
			{
				AccountId: new("333"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:333:log-group:group_c", Name: "group_c"},
			},
		}, results)
	})

	t.Run("Should return an empty error if api doesn't return any data", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		results, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{}, results)
	})

	t.Run("Should only use LogGroupNamePrefix even if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		// TODO: use LogGroupNamePattern when we have accounted for its behavior, still a little unexpected at the moment
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			Limit:              0,
			LogGroupNamePrefix: new("test"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: new("test"),
		})
	})

	t.Run("Should call api without LogGroupNamePrefix nor LogGroupNamePattern if not passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit: aws.Int32(0),
		})
	})

	t.Run("Should return an error when API returns error", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{},
			fmt.Errorf("some error"))
		service := NewLogGroupsService(mockLogsAPI, false)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.Error(t, err)
		assert.Equal(t, "some error", err.Error())
	})

	t.Run("Should only call the api once in case ListAllLogGroups is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:              2,
			LogGroupNamePrefix: new("test"),
			ListAllLogGroups:   false,
		}

		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: new("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: new("group_a")},
			},
			NextToken: aws.String("next_token"),
		}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		results, nextToken, err := service.GetLogGroups(context.Background(), req)

		assert.NoError(t, err)
		mockLogsAPI.AssertNumberOfCalls(t, "DescribeLogGroups", 1)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: new("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
		}, results)
		assert.Equal(t, aws.String("next_token"), nextToken)
	})

	t.Run("Should pass NextToken to the API when provided in the request", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:              2,
			LogGroupNamePrefix: new("test"),
			NextToken:          new("some_token"),
		}

		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
			NextToken:          new("some_token"),
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: new("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: new("group_a")},
			},
			NextToken: aws.String("another_token"),
		}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		results, nextToken, err := service.GetLogGroups(context.Background(), req)

		assert.NoError(t, err)
		mockLogsAPI.AssertNumberOfCalls(t, "DescribeLogGroups", 1)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: new("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
		}, results)
		assert.Equal(t, aws.String("another_token"), nextToken)
	})

	t.Run("Should keep on calling the api until NextToken is empty in case ListAllLogGroups is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:              2,
			LogGroupNamePrefix: new("test"),
			ListAllLogGroups:   true,
		}

		// first call
		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: new("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: new("group_a")},
			},
			NextToken: new("token"),
		}, nil)

		// second call
		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
			NextToken:          new("token"),
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: new("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: new("group_b")},
			},
		}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)
		results, nextToken, err := service.GetLogGroups(context.Background(), req)
		assert.NoError(t, err)
		mockLogsAPI.AssertNumberOfCalls(t, "DescribeLogGroups", 2)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: new("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
			{
				AccountId: new("222"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:222:log-group:group_b", Name: "group_b"},
			},
		}, results)
		assert.Nil(t, nextToken)
	})
}

func TestGetLogGroupsCrossAccountQuerying(t *testing.T) {
	t.Run("Should not includeLinkedAccounts or accountId if isCrossAccountEnabled is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: new("accountId")},
			LogGroupNamePrefix: new("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: new("prefix"),
		})
	})

	t.Run("Should replace LogGroupNamePrefix if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:     resources.ResourceRequest{AccountId: new("accountId")},
			LogGroupNamePrefix:  new("prefix"),
			LogGroupNamePattern: new("pattern"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    new("pattern"),
			IncludeLinkedAccounts: new(true),
		})
	})

	t.Run("Should includeLinkedAccounts,and accountId if isCrossAccountEnabled is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{AccountId: new("accountId")},
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:                 aws.Int32(0),
			IncludeLinkedAccounts: new(true),
			AccountIdentifiers:    []string{"accountId"},
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: new("accountId")},
			LogGroupNamePrefix: new("prefix"),
		})
		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    new("prefix"),
			IncludeLinkedAccounts: new(true),
		})
	})

	t.Run("Should not includeLinkedAccounts, or accountId if accountId is nil", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			LogGroupNamePrefix: new("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: new("prefix"),
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, _, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{
				AccountId: new("accountId"),
			},
			LogGroupNamePrefix: new("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			IncludeLinkedAccounts: new(true),
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    new("prefix"),
		})
	})
}

func TestGetLogGroupFields(t *testing.T) {
	t.Run("Should map log group fields response", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("GetLogGroupFields", mock.Anything).Return(
			&cloudwatchlogs.GetLogGroupFieldsOutput{
				LogGroupFields: []cloudwatchlogstypes.LogGroupField{
					{
						Name:    aws.String("field1"),
						Percent: 10,
					}, {
						Name:    aws.String("field2"),
						Percent: 10,
					}, {
						Name:    aws.String("field3"),
						Percent: 10,
					},
				},
			}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroupFields(context.Background(), resources.LogGroupFieldsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroupField]{
			{
				Value: resources.LogGroupField{
					Name:    "field1",
					Percent: 10,
				},
			},
			{
				Value: resources.LogGroupField{
					Name:    "field2",
					Percent: 10,
				},
			},
			{
				Value: resources.LogGroupField{
					Name:    "field3",
					Percent: 10,
				},
			},
		}, resp)
	})

	// uncomment this test if when it's possible to pass only LogGroupIdentifier to the api
	// t.Run("Should only set LogGroupIdentifier as api input in case both LogGroupName and LogGroupARN are specified", func(t *testing.T) {
	// 	mockLogsAPI := &mocks.LogsAPI{}
	// 	mockLogsAPI.On("GetLogGroupFields", mock.Anything).Return(
	// 		&cloudwatchlogs.GetLogGroupFieldsOutput{}, nil)

	// 	service := NewLogGroupsService(mockLogsAPI, false)
	// 	resp, err := service.GetLogGroupFields(resources.LogGroupFieldsRequest{
	// 		LogGroupName: "logGroupName",
	// 		LogGroupARN:  "logGroupARN",
	// 	})

	// 	mockLogsAPI.AssertCalled(t, "GetLogGroupFields", &cloudwatchlogs.GetLogGroupFieldsInput{
	// 		LogGroupIdentifier: utils.Pointer("logGroupARN"),
	// 		LogGroupName:       nil,
	// 	})
	// 	assert.NotNil(t, resp)
	// 	assert.NoError(t, err)
	// })

	// remove this test once the above test is uncommented
	t.Run("Should only set LogGroupName as api input in case both LogGroupName and LogGroupARN are specified", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("GetLogGroupFields", mock.Anything).Return(
			&cloudwatchlogs.GetLogGroupFieldsOutput{}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroupFields(context.Background(), resources.LogGroupFieldsRequest{
			LogGroupName: "logGroupName",
			LogGroupARN:  "logGroupARN",
		})

		mockLogsAPI.AssertCalled(t, "GetLogGroupFields", &cloudwatchlogs.GetLogGroupFieldsInput{
			LogGroupIdentifier: nil,
			LogGroupName:       new("logGroupName"),
		})
		assert.NotNil(t, resp)
		assert.NoError(t, err)
	})

	t.Run("Should only set LogGroupName as api input in case only LogGroupName is specified", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("GetLogGroupFields", mock.Anything).Return(
			&cloudwatchlogs.GetLogGroupFieldsOutput{}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroupFields(context.Background(), resources.LogGroupFieldsRequest{
			LogGroupName: "logGroupName",
			LogGroupARN:  "",
		})

		mockLogsAPI.AssertCalled(t, "GetLogGroupFields", &cloudwatchlogs.GetLogGroupFieldsInput{
			LogGroupIdentifier: nil,
			LogGroupName:       new("logGroupName"),
		})
		assert.NotNil(t, resp)
		assert.NoError(t, err)
	})
}
