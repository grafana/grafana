package metrics

import (
	"fmt"
	"strings"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	ResourceURI string

	// Following fields will be deprecated in grafana 9 and will not included in new queries.
	// For backwards compat, we recreate the ResourceURI using these fields
	DefaultSubscription string
	Subscription        string
	ResourceGroup       string
	MetricDefinition    string
	ResourceName        string
}

// BuildMetricsURL checks the metric definition property to see which form of the url
// should be returned
func (params *urlBuilder) BuildMetricsURL() string {
	resourceURI := params.ResourceURI

	// Prior to Grafana 9, we had a legacy query object rather than a resourceURI, so we manually create the resource URI
	if resourceURI == "" {
		subscription := params.Subscription

		if params.Subscription == "" {
			subscription = params.DefaultSubscription
		}

		metricDefinitionArray := strings.Split(params.MetricDefinition, "/")
		resourceNameArray := strings.Split(params.ResourceName, "/")
		provider := metricDefinitionArray[0]
		metricDefinitionArray = metricDefinitionArray[1:]

		urlArray := []string{
			subscription,
			"resourceGroups",
			params.ResourceGroup,
			"providers",
			provider,
		}

		for i := range metricDefinitionArray {
			urlArray = append(urlArray, metricDefinitionArray[i])
			urlArray = append(urlArray, resourceNameArray[i])
		}

		resourceURI = strings.Join(urlArray[:], "/")
	}

	return fmt.Sprintf("%s/providers/microsoft.insights/metrics", resourceURI)
}
