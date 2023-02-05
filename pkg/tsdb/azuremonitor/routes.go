package azuremonitor

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// Azure cloud query types
const (
	azureMonitor       = "Azure Monitor"
	azureLogAnalytics  = "Azure Log Analytics"
	azureResourceGraph = "Azure Resource Graph"
	azurePortal        = "Azure Portal"
)

var azManagement = types.AzRoute{
	URL:     "https://management.azure.com",
	Scopes:  []string{"https://management.azure.com/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azUSGovManagement = types.AzRoute{
	URL:     "https://management.usgovcloudapi.net",
	Scopes:  []string{"https://management.usgovcloudapi.net/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azChinaManagement = types.AzRoute{
	URL:     "https://management.chinacloudapi.cn",
	Scopes:  []string{"https://management.chinacloudapi.cn/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana"},
}

var azLogAnalytics = types.AzRoute{
	URL:     "https://api.loganalytics.io",
	Scopes:  []string{"https://api.loganalytics.io/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azChinaLogAnalytics = types.AzRoute{
	URL:     "https://api.loganalytics.azure.cn",
	Scopes:  []string{"https://api.loganalytics.azure.cn/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azUSGovLogAnalytics = types.AzRoute{
	URL:     "https://api.loganalytics.us",
	Scopes:  []string{"https://api.loganalytics.us/.default"},
	Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
}

var azPortal = types.AzRoute{
	URL: "https://management.azure.com",
}

var azUSGovPortal = types.AzRoute{
	URL: "https://management.usgovcloudapi.net",
}

var azChinaPortal = types.AzRoute{
	URL: "https://management.chinacloudapi.cn",
}

var (
	// The different Azure routes are identified by its cloud (e.g. public or gov)
	// and the service to query (e.g. Azure Monitor or Azure Log Analytics)
	routes = map[string]map[string]types.AzRoute{
		azsettings.AzurePublic: {
			azureMonitor:       azManagement,
			azureLogAnalytics:  azLogAnalytics,
			azureResourceGraph: azManagement,
			azurePortal:        azPortal,
		},
		azsettings.AzureUSGovernment: {
			azureMonitor:       azUSGovManagement,
			azureLogAnalytics:  azUSGovLogAnalytics,
			azureResourceGraph: azUSGovManagement,
			azurePortal:        azUSGovPortal,
		},
		azsettings.AzureChina: {
			azureMonitor:       azChinaManagement,
			azureLogAnalytics:  azChinaLogAnalytics,
			azureResourceGraph: azChinaManagement,
			azurePortal:        azChinaPortal,
		},
	}
)

func getAzureMonitorRoutes(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials) (map[string]types.AzRoute, error) {
	azureCloud, err := azcredentials.GetAzureCloud(settings, credentials)
	if err != nil {
		return nil, err
	}
	if route, ok := routes[azureCloud]; !ok {
		err := fmt.Errorf("the Azure cloud '%s' not supported by Azure Monitor datasource", azureCloud)
		return nil, err
	} else {
		return route, nil
	}
}
