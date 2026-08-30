package services

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	cloudwatchlogstypes "github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

func TestGetDataSourcesCrossAccountQuerying(t *testing.T) {
	t.Run("includes linked accounts when cross-account is enabled", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("ListAggregateLogGroupSummaries", &cloudwatchlogs.ListAggregateLogGroupSummariesInput{
			GroupBy:               cloudwatchlogstypes.ListAggregateLogGroupSummariesGroupByDataSourceNameAndType,
			IncludeLinkedAccounts: aws.Bool(true),
		}).Return(&cloudwatchlogs.ListAggregateLogGroupSummariesOutput{}, nil)

		service := NewDataSourcesService(mockLogsAPI, true)
		resp, err := service.GetDataSources(context.Background(), resources.DataSourcesRequest{})

		assert.NoError(t, err)
		assert.Empty(t, resp)
		mockLogsAPI.AssertNumberOfCalls(t, "ListAggregateLogGroupSummaries", 1)
	})

	t.Run("does not include linked accounts when cross-account is disabled", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("ListAggregateLogGroupSummaries", &cloudwatchlogs.ListAggregateLogGroupSummariesInput{
			GroupBy: cloudwatchlogstypes.ListAggregateLogGroupSummariesGroupByDataSourceNameAndType,
		}).Return(&cloudwatchlogs.ListAggregateLogGroupSummariesOutput{}, nil)

		service := NewDataSourcesService(mockLogsAPI, false)
		resp, err := service.GetDataSources(context.Background(), resources.DataSourcesRequest{})

		assert.NoError(t, err)
		assert.Empty(t, resp)
		mockLogsAPI.AssertNumberOfCalls(t, "ListAggregateLogGroupSummaries", 1)
	})

	t.Run("filters the returned data sources by pattern", func(t *testing.T) {
		mockLogsAPI := &mocks.LogsAPI{}
		mockLogsAPI.On("ListAggregateLogGroupSummaries", mock.Anything).Return(&cloudwatchlogs.ListAggregateLogGroupSummariesOutput{
			AggregateLogGroupSummaries: []cloudwatchlogstypes.AggregateLogGroupSummary{
				{
					GroupingIdentifiers: []cloudwatchlogstypes.GroupingIdentifier{
						{Key: aws.String("DataSource.Name"), Value: aws.String("amazon_vpc")},
						{Key: aws.String("DataSource.Type"), Value: aws.String("flow")},
					},
				},
				{
					GroupingIdentifiers: []cloudwatchlogstypes.GroupingIdentifier{
						{Key: aws.String("DataSource.Name"), Value: aws.String("amazon_eks")},
						{Key: aws.String("DataSource.Type"), Value: aws.String("audit")},
					},
				},
			},
		}, nil)

		service := NewDataSourcesService(mockLogsAPI, true)
		resp, err := service.GetDataSources(context.Background(), resources.DataSourcesRequest{
			Pattern: aws.String("eks"),
		})

		assert.NoError(t, err)
		assert.Equal(t, []resources.ResourceResponse[resources.LogDataSource]{
			{
				Value: resources.LogDataSource{
					Name: "amazon_eks",
					Type: "audit",
				},
			},
		}, resp)
	})
}
