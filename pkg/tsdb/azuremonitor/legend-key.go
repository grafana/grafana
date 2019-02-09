package azuremonitor

import "fmt"

// formatLegendKey builds the legend key or timeseries name
func formatLegendKey(resourceName string, metricName string, metadataName string, metadataValue string) string {
	if len(metadataName) > 0 {
		return fmt.Sprintf("%s{%s=%s}.%s", resourceName, metadataName, metadataValue, metricName)
	}
	return fmt.Sprintf("%s.%s", resourceName, metricName)
}
