package azuremonitor

import (
	"encoding/json"
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// Azure cloud query types
const (
	azureMonitor       = "Azure Monitor"
	azureLogAnalytics  = "Azure Log Analytics"
	azureResourceGraph = "Azure Resource Graph"
	azureTraces        = "Azure Traces"
	azurePortal        = "Azure Portal"
)

func getAzureMonitorRoutes(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials, jsonData json.RawMessage) (map[string]types.AzRoute, error) {
	azureCloud, err := azcredentials.GetAzureCloud(settings, credentials)
	if err != nil {
		return nil, err
	}

	if azureCloud == azsettings.AzureCustomized {
		routes, err := getCustomizedCloudRoutes(jsonData)
		if err != nil {
			return nil, err
		}
		return routes, nil
	}

	cloudSettings, err := settings.GetCloud(azureCloud)
	if err != nil {
		return nil, err
	}

	resourceManagerUrl, ok := cloudSettings.Properties["resourceManager"]
	if !ok {
		err := fmt.Errorf("the Azure cloud '%s' doesn't have configuration for Azure Resource Manager", azureCloud)
		return nil, err
	}
	resourceManagerScopes, err := audienceToScopes(resourceManagerUrl)
	if err != nil {
		return nil, err
	}
	resourceManagerRoute := types.AzRoute{
		URL:     resourceManagerUrl,
		Scopes:  resourceManagerScopes,
		Headers: map[string]string{"x-ms-app": "Grafana"},
	}
	logAnalyticsUrl, ok := cloudSettings.Properties["logAnalytics"]
	if !ok {
		err := fmt.Errorf("the Azure cloud '%s' doesn't have configuration for Azure Log Analytics", azureCloud)
		return nil, err
	}
	logAnalyticsScopes, err := audienceToScopes(logAnalyticsUrl)
	if err != nil {
		return nil, err
	}
	logAnalyticsRoute := types.AzRoute{
		URL:     logAnalyticsUrl,
		Scopes:  logAnalyticsScopes,
		Headers: map[string]string{"x-ms-app": "Grafana", "Cache-Control": "public, max-age=60"},
	}
	portalUrl, ok := cloudSettings.Properties["portal"]
	if !ok {
		err := fmt.Errorf("the Azure cloud '%s' doesn't have configuration for Azure Portal", azureCloud)
		return nil, err
	}
	portalRoute := types.AzRoute{
		URL: portalUrl,
	}

	routes := map[string]types.AzRoute{
		azureMonitor:       resourceManagerRoute,
		azureLogAnalytics:  logAnalyticsRoute,
		azureResourceGraph: resourceManagerRoute,
		azureTraces:        logAnalyticsRoute,
		azurePortal:        portalRoute,
	}

	return routes, nil
}

func getCustomizedCloudRoutes(jsonData json.RawMessage) (map[string]types.AzRoute, error) {
	customizedCloudSettings := types.AzureMonitorCustomizedCloudSettings{}
	err := json.Unmarshal(jsonData, &customizedCloudSettings)
	if err != nil {
		return nil, fmt.Errorf("error getting customized cloud settings: %w", err)
	}

	if customizedCloudSettings.CustomizedRoutes == nil {
		return nil, fmt.Errorf("unable to instantiate routes, customizedRoutes must be set")
	}

	azureRoutes := customizedCloudSettings.CustomizedRoutes
	return azureRoutes, nil
}

func audienceToScopes(audience string) ([]string, error) {
	resourceId, err := url.Parse(audience)
	if err != nil || resourceId.Scheme == "" || resourceId.Host == "" {
		err = fmt.Errorf("endpoint resource ID (audience) '%s' invalid", audience)
		return nil, err
	}

	resourceId.Path = path.Join(resourceId.Path, ".default")
	scopes := []string{resourceId.String()}
	return scopes, nil
}
