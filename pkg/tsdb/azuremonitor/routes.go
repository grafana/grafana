package azuremonitor

import "fmt"

func getManagementApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case "azuremonitor":
		return "azuremonitor", nil
	case "chinaazuremonitor":
		return "chinaazuremonitor", nil
	case "govazuremonitor":
		return "govazuremonitor", nil
	case "germanyazuremonitor":
		return "germanyazuremonitor", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}

func getLogAnalyticsApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case "azuremonitor":
		return "loganalyticsazure", nil
	case "chinaazuremonitor":
		return "chinaloganalyticsazure", nil
	case "govazuremonitor":
		return "govloganalyticsazure", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}

func getAppInsightsApiRoute(azureCloud string) (string, error) {
	switch azureCloud {
	case "azuremonitor":
		return "appinsights", nil
	case "chinaazuremonitor":
		return "chinaappinsights", nil
	default:
		err := fmt.Errorf("the cloud '%s' not supported", azureCloud)
		return "", err
	}
}
