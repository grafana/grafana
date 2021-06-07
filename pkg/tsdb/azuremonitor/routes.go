package azuremonitor

type azRoute struct {
	url     string
	scopes  []string
	headers map[string]string
}

var azManagement = azRoute{
	url:     "https://management.azure.com",
	scopes:  []string{"https://management.azure.com/.default"},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azUSGovManagement = azRoute{
	url:     "https://management.usgovcloudapi.net",
	scopes:  []string{"https://management.usgovcloudapi.net/.default"},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azGermanyManagement = azRoute{
	url:     "https://management.microsoftazure.de",
	scopes:  []string{"https://management.microsoftazure.de/.default"},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azChinaManagement = azRoute{
	url:     "https://management.chinacloudapi.cn",
	scopes:  []string{"https://management.chinacloudapi.cn/.default"},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azAppInsights = azRoute{
	url:     "https://api.applicationinsights.io",
	scopes:  []string{},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azChinaAppInsights = azRoute{
	url:     "https://api.applicationinsights.azure.cn",
	scopes:  []string{},
	headers: map[string]string{"x-ms-app": "Grafana"},
}

var azLogAnalytics = azRoute{
	url:     "https://api.loganalytics.io",
	scopes:  []string{"https://api.loganalytics.io/.default"},
	headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azChinaLogAnalytics = azRoute{
	url:     "https://api.loganalytics.azure.cn",
	scopes:  []string{"https://api.loganalytics.azure.cn/.default"},
	headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azUSGovLogAnalytics = azRoute{
	url:     "https://api.loganalytics.us",
	scopes:  []string{"https://api.loganalytics.us/.default"},
	headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var (
	// The different Azure routes are identified by its cloud (e.g. public or gov)
	// and the service to query (e.g. Azure Monitor or Azure Log Analytics)
	routes = map[string]map[string]azRoute{
		azureMonitorPublic: {
			azureMonitor:      azManagement,
			appInsights:       azAppInsights,
			azureLogAnalytics: azLogAnalytics,
		},
		azureMonitorUSGovernment: {
			azureMonitor:      azUSGovManagement,
			azureLogAnalytics: azUSGovLogAnalytics,
		},
		azureMonitorGermany: {
			azureMonitor: azGermanyManagement,
		},
		azureMonitorChina: {
			azureMonitor:      azChinaManagement,
			appInsights:       azChinaAppInsights,
			azureLogAnalytics: azChinaLogAnalytics,
		},
	}
)
