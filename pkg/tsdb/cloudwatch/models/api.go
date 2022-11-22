package models

import (
	"net/url"

	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
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
	OAMClientProvider     OAMClientProvider
	Settings              CloudWatchSettings
	Features              featuremgmt.FeatureToggles
}

type ListMetricsProvider interface {
	GetDimensionKeysByDimensionFilter(resources.DimensionKeysRequest) ([]resources.ResourceResponse[string], error)
	GetDimensionValuesByDimensionFilter(resources.DimensionValuesRequest) ([]resources.ResourceResponse[string], error)
	GetMetricsByNamespace(r resources.MetricsRequest) ([]resources.ResourceResponse[resources.Metric], error)
}

type MetricsClientProvider interface {
	ListMetricsWithPageLimit(params *cloudwatch.ListMetricsInput) ([]resources.MetricResponse, error)
}

type CloudWatchMetricsAPIProvider interface {
	ListMetricsPages(*cloudwatch.ListMetricsInput, func(*cloudwatch.ListMetricsOutput, bool) bool) error
}

type CloudWatchLogsAPIProvider interface {
	DescribeLogGroups(*cloudwatchlogs.DescribeLogGroupsInput) (*cloudwatchlogs.DescribeLogGroupsOutput, error)
}

type OAMClientProvider interface {
	ListSinks(*oam.ListSinksInput) (*oam.ListSinksOutput, error)
	ListAttachedLinks(*oam.ListAttachedLinksInput) (*oam.ListAttachedLinksOutput, error)
}

type LogGroupsProvider interface {
	GetLogGroups(request resources.LogGroupsRequest) ([]resources.ResourceResponse[resources.LogGroup], error)
}

type AccountsProvider interface {
	GetAccountsForCurrentUserOrRole() ([]resources.ResourceResponse[resources.Account], error)
}
