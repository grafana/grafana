package azuremonitor

import "github.com/grafana/grafana/pkg/setting"

// Azure cloud query types
const (
	azureMonitor       = "Azure Monitor"
	appInsights        = "Application Insights"
	azureLogAnalytics  = "Azure Log Analytics"
	insightsAnalytics  = "Insights Analytics"
	azureResourceGraph = "Azure Resource Graph"
)

type azRoute struct {
	URL     string
	Scopes  []string
	Headers map[string]string
}

var azManagement = azRoute{
	URL:     "https://management.azure.com",
	Scopes:  []string{"https://management.azure.com/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azUSGovManagement = azRoute{
	URL:     "https://management.usgovcloudapi.net",
	Scopes:  []string{"https://management.usgovcloudapi.net/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azGermanyManagement = azRoute{
	URL:     "https://management.microsoftazure.de",
	Scopes:  []string{"https://management.microsoftazure.de/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azChinaManagement = azRoute{
	URL:     "https://management.chinacloudapi.cn",
	Scopes:  []string{"https://management.chinacloudapi.cn/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azAppInsights = azRoute{
	URL:     "https://api.applicationinsights.io",
	Scopes:  []string{},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azChinaAppInsights = azRoute{
	URL:     "https://api.applicationinsights.azure.cn",
	Scopes:  []string{},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azLogAnalytics = azRoute{
	URL:     "https://api.loganalytics.io",
	Scopes:  []string{"https://api.loganalytics.io/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azChinaLogAnalytics = azRoute{
	URL:     "https://api.loganalytics.azure.cn",
	Scopes:  []string{"https://api.loganalytics.azure.cn/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azUSGovLogAnalytics = azRoute{
	URL:     "https://api.loganalytics.us",
	Scopes:  []string{"https://api.loganalytics.us/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var (
	// The different Azure routes are identified by its cloud (e.g. public or gov)
	// and the service to query (e.g. Azure Monitor or Azure Log Analytics)
	routes = map[string]map[string]azRoute{
		setting.AzurePublic: {
			azureMonitor:       azManagement,
			azureLogAnalytics:  azLogAnalytics,
			azureResourceGraph: azManagement,
			appInsights:        azAppInsights,
			insightsAnalytics:  azAppInsights,
		},
		setting.AzureUSGovernment: {
			azureMonitor:       azUSGovManagement,
			azureLogAnalytics:  azUSGovLogAnalytics,
			azureResourceGraph: azUSGovManagement,
		},
		setting.AzureGermany: {
			azureMonitor: azGermanyManagement,
		},
		setting.AzureChina: {
			azureMonitor:       azChinaManagement,
			azureLogAnalytics:  azChinaLogAnalytics,
			azureResourceGraph: azChinaManagement,
			appInsights:        azChinaAppInsights,
			insightsAnalytics:  azChinaAppInsights,
		},
	}
)
