package deprecated

import (
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// Azure cloud query types
const (
	AppInsights       = "Application Insights"
	InsightsAnalytics = "Insights Analytics"
)

var AzAppInsights = types.AzRoute{
	URL:     "https://api.applicationinsights.io",
	Scopes:  []string{},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var AzChinaAppInsights = types.AzRoute{
	URL:     "https://api.applicationinsights.azure.cn",
	Scopes:  []string{},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}
