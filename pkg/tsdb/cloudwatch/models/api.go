package models

import (
	"context"
	"net/url"

	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/oam"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type RequestContextFactoryFunc func(ctx context.Context, region string) (reqCtx RequestContext, err error)

type RouteHandlerFunc func(ctx context.Context, parameters url.Values) ([]byte, *HttpError)

type RequestContext struct {
	MetricsClientProvider  MetricsClientProvider
	ListMetricsAPIProvider cloudwatch.ListMetricsAPIClient
	LogsAPIProvider        CloudWatchLogsAPIProvider
	OAMAPIProvider         OAMAPIProvider
	EC2APIProvider         EC2APIProvider
	Settings               CloudWatchSettings
	Logger                 log.Logger
}

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(ctx context.Context, r resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error)
	GetDimensionValuesByDimensionFilter(ctx context.Context, r resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error)
	GetMetricsByNamespace(ctx context.Context, r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error)
}

type LogGroupsProvider interface {
	GetLogGroups(ctx context.Context, request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error)
	GetLogGroupFields(ctx context.Context, request resources.LogGroupFieldsRequest) ([]resources.ResourceResponse[resources.LogGroupField], error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole(ctx context.Context) ([]resources.ResourceResponse[resources.Account], error)
}

type RegionsAPIProvider interface {
	GetRegions(ctx context.Context) ([]resources.ResourceResponse[resources.Region], error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(ctx context.Context, params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetrics(ctx context.Context, in *cloudwatch.ListMetricsInput, optFns ...func(*cloudwatch.Options)) error
}

type CloudWatchLogsAPIProvider interface {
	cloudwatchlogs.DescribeLogGroupsAPIClient
	GetLogGroupFields(ctx context.Context, in *cloudwatchlogs.GetLogGroupFieldsInput, optFns ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetLogGroupFieldsOutput, error)
}

type OAMAPIProvider interface {
	oam.ListSinksAPIClient
	oam.ListAttachedLinksAPIClient
}

type EC2APIProvider interface {
	DescribeRegions(ctx context.Context, in *ec2.DescribeRegionsInput, optFns ...func(*ec2.Options)) (*ec2.DescribeRegionsOutput, error)
	ec2.DescribeInstancesAPIClient
}

type CWLogsClient interface {
	StartQuery(context.Context, *cloudwatchlogs.StartQueryInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StartQueryOutput, error)
	StopQuery(context.Context, *cloudwatchlogs.StopQueryInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.StopQueryOutput, error)
	GetQueryResults(context.Context, *cloudwatchlogs.GetQueryResultsInput, ...func(*cloudwatchlogs.Options)) (*cloudwatchlogs.GetQueryResultsOutput, error)

	cloudwatchlogs.GetLogEventsAPIClient
	cloudwatchlogs.DescribeLogGroupsAPIClient
}

type CWClient interface {
	AlarmsAPI
	cloudwatch.GetMetricDataAPIClient
	cloudwatch.ListMetricsAPIClient
}

type AlarmsAPI interface {
	cloudwatch.DescribeAlarmsAPIClient
	cloudwatch.DescribeAlarmHistoryAPIClient

	DescribeAlarmsForMetric(context.Context, *cloudwatch.DescribeAlarmsForMetricInput, ...func(*cloudwatch.Options)) (*cloudwatch.DescribeAlarmsForMetricOutput, error)
}
