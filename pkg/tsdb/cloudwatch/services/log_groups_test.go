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
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestGetLogGroups(t *testing.T) {
	t.Run("Should map log groups response", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(
			&cloudwatchlogs.DescribeLogGroupsOutput{
				LogGroups: []cloudwatchlogstypes.LogGroup{
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: utils.Pointer("group_a")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: utils.Pointer("group_b")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:333:log-group:group_c"), LogGroupName: utils.Pointer("group_c")},
				},
			}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		resp, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

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

	t.Run("Should return an empty error if api doesn't return any data", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		resp, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{}, resp)
	})

	t.Run("Should only use LogGroupNamePrefix even if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		// TODO: use LogGroupNamePattern when we have accounted for its behavior, still a little unexpected at the moment
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			Limit:              0,
			LogGroupNamePrefix: utils.Pointer("test"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: utils.Pointer("test"),
		})
	})

	t.Run("Should call api without LogGroupNamePrefix nor LogGroupNamePattern if not passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

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

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{})

		assert.Error(t, err)
		assert.Equal(t, "some error", err.Error())
	})

	t.Run("Should only call the api once in case ListAllLogGroups is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:              2,
			LogGroupNamePrefix: utils.Pointer("test"),
			ListAllLogGroups:   false,
		}

		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: utils.Pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: utils.Pointer("group_a")},
			},
			NextToken: aws.String("next_token"),
		}, nil)

		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroups(context.Background(), req)

		assert.NoError(t, err)
		mockLogsAPI.AssertNumberOfCalls(t, "DescribeLogGroups", 1)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: utils.Pointer("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
		}, resp)
	})

	t.Run("Should keep on calling the api until NextToken is empty in case ListAllLogGroups is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:              2,
			LogGroupNamePrefix: utils.Pointer("test"),
			ListAllLogGroups:   true,
		}

		// first call
		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: utils.Pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: utils.Pointer("group_a")},
			},
			NextToken: utils.Pointer("token"),
		}, nil)

		// second call
		mockLogsAPI.On("DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(req.Limit),
			LogGroupNamePrefix: req.LogGroupNamePrefix,
			NextToken:          utils.Pointer("token"),
		}).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: []cloudwatchlogstypes.LogGroup{
				{Arn: utils.Pointer("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: utils.Pointer("group_b")},
			},
		}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroups(context.Background(), req)
		assert.NoError(t, err)
		mockLogsAPI.AssertNumberOfCalls(t, "DescribeLogGroups", 2)
		assert.Equal(t, []resources.ResourceResponse[resources.LogGroup]{
			{
				AccountId: utils.Pointer("111"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:111:log-group:group_a", Name: "group_a"},
			},
			{
				AccountId: utils.Pointer("222"),
				Value:     resources.LogGroup{Arn: "arn:aws:logs:us-east-1:222:log-group:group_b", Name: "group_b"},
			},
		}, resp)
	})

	t.Run("Should sort by name descending when OrderBy is nameDesc", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(
			&cloudwatchlogs.DescribeLogGroupsOutput{
				LogGroups: []cloudwatchlogstypes.LogGroup{
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:111:log-group:group_a"), LogGroupName: utils.Pointer("group_a")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:222:log-group:group_b"), LogGroupName: utils.Pointer("group_b")},
					{Arn: utils.Pointer("arn:aws:logs:us-east-1:333:log-group:group_c"), LogGroupName: utils.Pointer("group_c")},
				},
			}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		resp, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			OrderBy: resources.OrderByNameDesc,
		})

		assert.NoError(t, err)
		assert.Equal(t, "group_c", resp[0].Value.Name)
		assert.Equal(t, "group_b", resp[1].Value.Name)
		assert.Equal(t, "group_a", resp[2].Value.Name)
	})

	t.Run("Should cap results at MaxLogGroupsResults when ListAllLogGroups is true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		req := resources.LogGroupsRequest{
			Limit:            500,
			ListAllLogGroups: true,
		}
		// First page: 600 results
		mockLogsAPI.On("DescribeLogGroups", mock.MatchedBy(func(input *cloudwatchlogs.DescribeLogGroupsInput) bool {
			return input.NextToken == nil
		})).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: makeLogGroups(0, 600),
			NextToken: utils.Pointer("tok"),
		}, nil)
		// Second page: 600 more (total 1200, cap at 1000)
		mockLogsAPI.On("DescribeLogGroups", mock.MatchedBy(func(input *cloudwatchlogs.DescribeLogGroupsInput) bool {
			return input.NextToken != nil && *input.NextToken == "tok"
		})).Return(&cloudwatchlogs.DescribeLogGroupsOutput{
			LogGroups: makeLogGroups(600, 600),
		}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)
		resp, err := service.GetLogGroups(context.Background(), req)
		assert.NoError(t, err)
		assert.Len(t, resp, int(resources.MaxLogGroupsResults))
	})
}

func makeLogGroups(start, count int) []cloudwatchlogstypes.LogGroup {
	out := make([]cloudwatchlogstypes.LogGroup, count)
	for i := 0; i < count; i++ {
		n := start + i
		out[i] = cloudwatchlogstypes.LogGroup{
			Arn:           utils.Pointer(fmt.Sprintf("arn:aws:logs:us-east-1:111:log-group:g%d", n)),
			LogGroupName:  utils.Pointer(fmt.Sprintf("g%d", n)),
		}
	}
	return out
}

func TestGetLogGroupsCrossAccountQuerying(t *testing.T) {
	t.Run("Should not includeLinkedAccounts or accountId if isCrossAccountEnabled is set to false", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, false)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
	})

	t.Run("Should replace LogGroupNamePrefix if LogGroupNamePattern passed in resource call", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:     resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix:  utils.Pointer("prefix"),
			LogGroupNamePattern: utils.Pointer("pattern"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    utils.Pointer("pattern"),
			IncludeLinkedAccounts: utils.Pointer(true),
		})
	})

	t.Run("Should includeLinkedAccounts,and accountId if isCrossAccountEnabled is set to true", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:                 aws.Int32(0),
			IncludeLinkedAccounts: utils.Pointer(true),
			AccountIdentifiers:    []string{"accountId"},
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest:    resources.ResourceRequest{AccountId: utils.Pointer("accountId")},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    utils.Pointer("prefix"),
			IncludeLinkedAccounts: utils.Pointer(true),
		})
	})

	t.Run("Should not includeLinkedAccounts, or accountId if accountId is nil", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			Limit:              aws.Int32(0),
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})
	})

	t.Run("Should should not override prefix is there is no logGroupNamePattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("DescribeLogGroups", mock.Anything).Return(&cloudwatchlogs.DescribeLogGroupsOutput{}, nil)
		service := NewLogGroupsService(mockLogsAPI, true)

		_, err := service.GetLogGroups(context.Background(), resources.LogGroupsRequest{
			ResourceRequest: resources.ResourceRequest{
				AccountId: utils.Pointer("accountId"),
			},
			LogGroupNamePrefix: utils.Pointer("prefix"),
		})

		assert.NoError(t, err)
		mockLogsAPI.AssertCalled(t, "DescribeLogGroups", &cloudwatchlogs.DescribeLogGroupsInput{
			AccountIdentifiers:    []string{"accountId"},
			IncludeLinkedAccounts: utils.Pointer(true),
			Limit:                 aws.Int32(0),
			LogGroupNamePrefix:    utils.Pointer("prefix"),
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
			LogGroupName:       utils.Pointer("logGroupName"),
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
			LogGroupName:       utils.Pointer("logGroupName"),
		})
		assert.NotNil(t, resp)
		assert.NoError(t, err)
	})
}
