package models

import (
	"net/url"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

type RequestContextFactoryFunc func(pluginCtx backend.PluginContext, region string) (reqCtx RequestContext, err error)

type RouteHandlerFunc func(pluginCtx backend.PluginContext, reqContextFactory RequestContextFactoryFunc, parameters url.Values) ([]byte, *HttpError)

type RequestContext struct {
	MetricsClientProvider MetricsClientProvider
	LogsAPIProvider       CloudWatchLogsAPIProvider
	OAMAPIProvider        OAMAPIProvider
	Settings              CloudWatchSettings
	Features              featuremgmt.FeatureToggles
}

// Services
type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error)
	GetDimensionValuesByDimensionFilter(resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error)
	GetMetricsByNamespace(r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error)
}

type LogGroupsProvider interface {
	GetLogGroups(request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error)
	GetLogGroupFields(request resources.LogGroupFieldsRequest) ([]resources.ResourceResponse[resources.LogGroupField], error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole() ([]resources.ResourceResponse[resources.Account], error)
}

// Clients
type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error)
}

// APIs - instead of using the API defined in the services within the aws-sdk-go directly, specify a subset of the API with methods that are actually used in a service or a client
type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}

type CloudWatchLogsAPIProvider interface {
	DescribeLogGroups(*cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error)
	GetLogGroupFields(*cloudwatchlogs.GetLogGroupFieldsInput) (*cloudwatchlogs.GetLogGroupFieldsOutput, error)
}

type OAMAPIProvider interface {
	ListSinks(*oam.ListSinksInput) (*oam.ListSinksOutput, error)
	ListAttachedLinks(*oam.ListAttachedLinksInput) (*oam.ListAttachedLinksOutput, error)
}

type EC2APIProvider interface {
	DescribeRegions(in *ec2.DescribeRegionsInput) (*ec2.DescribeRegionsOutput, error)
	DescribeInstancesPages(in *ec2.DescribeInstancesInput, fn func(*ec2.DescribeInstancesOutput, bool) bool) error
}
