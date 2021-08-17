package azuremonitor

import (
	"fmt"
	"strings"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	DefaultSubscription string
	Subscription        string
	ResourceGroup       string
	MetricDefinition    string
	ResourceName        string
}

// Build checks the metric definition property to see which form of the url
// should be returned
func (ub *urlBuilder) Build() string {
	subscription := ub.Subscription

	if ub.Subscription == "" {
		subscription = ub.DefaultSubscription
	}

	metricDefinitionArray := strings.Split(ub.MetricDefinition, "/")
	resourceNameArray := strings.Split(ub.ResourceName, "/")
	provider := metricDefinitionArray[0]
	metricDefinitionArray = metricDefinitionArray[1:]

	urlArray := []string{subscription, "resourceGroups", ub.ResourceGroup, "providers", provider}

	for i := range metricDefinitionArray {
		urlArray = append(urlArray, metricDefinitionArray[i])
		urlArray = append(urlArray, resourceNameArray[i])
	}

	return fmt.Sprintf("%s/providers/microsoft.insights/metrics", strings.Join(urlArray[:], "/"))
}
