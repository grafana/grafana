package azuremonitor

import "fmt"

func getManagementApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case azureMonitorPublic:
		return "azuremonitor", nil
	case azureMonitorChina:
		return "chinaazuremonitor", nil
	case azureMonitorUSGovernment:
		return "govazuremonitor", nil
	case azureMonitorGermany:
		return "germanyazuremonitor", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}

func getLogAnalyticsApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case azureMonitorPublic:
		return "loganalyticsazure", nil
	case azureMonitorChina:
		return "chinaloganalyticsazure", nil
	case azureMonitorUSGovernment:
		return "govloganalyticsazure", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}

func getAppInsightsApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case azureMonitorPublic:
		return "appinsights", nil
	case azureMonitorChina:
		return "chinaappinsights", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}
