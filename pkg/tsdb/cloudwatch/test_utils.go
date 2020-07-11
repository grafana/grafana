package cloudwatch

import (
	"context"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatch/cloudwatchiface"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs/cloudwatchlogsiface"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

func fakeDataSource() *models.DataSource {
	jsonData := simplejson.New()
	jsonData.Set("defaultRegion", "default")
	return &models.DataSource{
		Id:             1,
		Database:       "default",
		JsonData:       jsonData,
		SecureJsonData: securejsondata.SecureJsonData{},
	}
}

type fakeCWLogsClient struct {
	cloudwatchlogsiface.CloudWatchLogsAPI
	logGroups      cloudwatchlogs.DescribeLogGroupsOutput
	logGroupFields cloudwatchlogs.GetLogGroupFieldsOutput
	queryResults   cloudwatchlogs.GetQueryResultsOutput
}

func (m fakeCWLogsClient) GetQueryResultsWithContext(ctx context.Context, input *cloudwatchlogs.GetQueryResultsInput, option ...request.Option) (*cloudwatchlogs.GetQueryResultsOutput, error) {
	return &m.queryResults, nil
}

func (m fakeCWLogsClient) StartQueryWithContext(ctx context.Context, input *cloudwatchlogs.StartQueryInput, option ...request.Option) (*cloudwatchlogs.StartQueryOutput, error) {
	return &cloudwatchlogs.StartQueryOutput{
		QueryId: aws.String("abcd-efgh-ijkl-mnop"),
	}, nil
}

func (m fakeCWLogsClient) StopQueryWithContext(ctx context.Context, input *cloudwatchlogs.StopQueryInput, option ...request.Option) (*cloudwatchlogs.StopQueryOutput, error) {
	return &cloudwatchlogs.StopQueryOutput{
		Success: aws.Bool(true),
	}, nil
}

func (m fakeCWLogsClient) DescribeLogGroupsWithContext(ctx context.Context, input *cloudwatchlogs.DescribeLogGroupsInput, option ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error) {
	return &m.logGroups, nil
}

func (m fakeCWLogsClient) GetLogGroupFieldsWithContext(ctx context.Context, input *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error) {
	return &m.logGroupFields, nil
}

type fakeCWClient struct {
	cloudwatchiface.CloudWatchAPI

	metrics []*cloudwatch.Metric
}

func (c fakeCWClient) ListMetricsPages(input *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool) error {
	fn(&cloudwatch.ListMetricsOutput{
		Metrics: c.metrics,
	}, true)
	return nil
}
