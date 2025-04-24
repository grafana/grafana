package models

import (
	"context"
	"net/url"

	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type RequestContextFactoryFunc func(ctx context.Context, pluginCtx backend.PluginContext, region string) (reqCtx RequestContext, err error)

type RouteHandlerFunc func(ctx context.Context, pluginCtx backend.PluginContext, reqContextFactory RequestContextFactoryFunc, parameters url.Values) ([]byte, *HttpError)

type RequestContext struct {
	MetricsClientProvider MetricsClientProvider
	LogsAPIProvider       CloudWatchLogsAPIProvider
	OAMAPIProvider        OAMAPIProvider
	EC2APIProvider        EC2APIProvider
	Settings              CloudWatchSettings
	Logger                log.Logger
}

// Services
type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(ctx context.Context, r resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error)
	GetDimensionValuesByDimensionFilter(ctx context.Context, r resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error)
	GetMetricsByNamespace(ctx context.Context, r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error)
}

type LogGroupsProvider interface {
	GetLogGroupsWithContext(ctx context.Context, request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error)
	GetLogGroupFieldsWithContext(ctx context.Context, request resources.LogGroupFieldsRequest, option ...request.Option) ([]resources.ResourceResponse[resources.LogGroupField], error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole(ctx context.Context) ([]resources.ResourceResponse[resources.Account], error)
}

type RegionsAPIProvider interface {
	GetRegions(ctx context.Context) ([]resources.ResourceResponse[resources.Region], error)
}

// Clients
type MetricsClientProvider interface {
	ListMetricsWithPageLimit(ctx context.Context, params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error)
}

// APIs - instead of using the API defined in the services within the aws-sdk-go directly, specify a subset of the API with methods that are actually used in a service or a client
type CloudWatchMetricsAPIProvider interface {
	ListMetricsPagesWithContext(ctx context.Context, in *cloudwatch.ListMetricsInput, fn func(*cloudwatch.ListMetricsOutput, bool) bool, opts ...request.Option) error
}

type CloudWatchLogsAPIProvider interface {
	DescribeLogGroupsWithContext(ctx context.Context, in *cloudwatchlogs.DescribeLogGroupsInput, opts ...request.Option) (*cloudwatchlogs.DescribeLogGroupsOutput, error)
	GetLogGroupFieldsWithContext(ctx context.Context, in *cloudwatchlogs.GetLogGroupFieldsInput, option ...request.Option) (*cloudwatchlogs.GetLogGroupFieldsOutput, error)
}

type OAMAPIProvider interface {
	ListSinksWithContext(ctx context.Context, in *oam.ListSinksInput, opts ...request.Option) (*oam.ListSinksOutput, error)
	ListAttachedLinksWithContext(ctx context.Context, in *oam.ListAttachedLinksInput, opts ...request.Option) (*oam.ListAttachedLinksOutput, error)
}

type EC2APIProvider interface {
	DescribeRegionsWithContext(ctx context.Context, in *ec2.DescribeRegionsInput, opts ...request.Option) (*ec2.DescribeRegionsOutput, error)
	DescribeInstancesPagesWithContext(ctx context.Context, in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool, opts ...request.Option) error
}
