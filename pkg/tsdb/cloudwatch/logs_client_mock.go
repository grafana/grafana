package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
)

type FakeLogsClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI
	Config aws.Config
}

func (f FakeLogsClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return &cloudwatchlogs.DescribeLogGroupsOutput{
		LogGroups: []*cloudwatchlogs.LogGroup{
			{
				LogGroupName: aws.String("group_a"),
			},
			{
				LogGroupName: aws.String("group_b"),
			},
			{
				LogGroupName: aws.String("group_c"),
			},
		},
	}, nil
}

func (f FakeLogsClient) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &cloudwatchlogs.GetLogGroupFieldsOutput{
		LogGroupFields: []*cloudwatchlogs.LogGroupField{
			{
				Name:    aws.String("field_a"),
				Percent: aws.Int64(100),
			},
			{
				Name:    aws.String("field_b"),
				Percent: aws.Int64(30),
			},
			{
				Name:    aws.String("field_c"),
				Percent: aws.Int64(55),
			},
		},
	}, nil
}

func (f FakeLogsClient) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (f FakeLogsClient) StopQueryWithContext(ctx context.Context, input *cloudwatchlogs.StopQueryInput, option ...request.Option) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: aws.Bool(true),
	}, nil
}

func (f FakeLogsClient) GetQueryResultsWithContext(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, option ...request.Option) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return &cloudwatchlogs.GetQueryResultsOutput{
		Results: [][]*cloudwatchlogs.ResultField{
			{
				{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-20 10:37:23.000"),
				},
				{
					Field: aws.String("field_b"),
					Value: aws.String("b_1"),
				},
				{
					Field: aws.String("@ptr"),
					Value: aws.String("abcdefg"),
				},
			},

			{
				{
					Field: aws.String("@timestamp"),
					Value: aws.String("2020-03-20 10:40:43.000"),
				},
				{
					Field: aws.String("field_b"),
					Value: aws.String("b_2"),
				},
				{
					Field: aws.String("@ptr"),
					Value: aws.String("hijklmnop"),
				},
			},
		},

		Statistics: &cloudwatchlogs.QueryStatistics{
			BytesScanned:   aws.Float64(512),
			RecordsMatched: aws.Float64(256),
			RecordsScanned: aws.Float64(1024),
		},

		Status: aws.String("Complete"),
	}, nil
}
