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

func (params *urlBuilder) buildResourceURIFromLegacyQuery() string {
	subscription := params.Subscription

	if params.Subscription == "" {
		subscription = params.DefaultSubscription
	}

	metricDefinitionArray := strings.Split(params.MetricDefinition, "/")
	resourceNameArray := strings.Split(params.ResourceName, "/")
	provider := metricDefinitionArray[0]
	metricDefinitionArray = metricDefinitionArray[1:]

	urlArray := []string{
		"/subscriptions",
		subscription,
		"resourceGroups",
		params.ResourceGroup,
		"providers",
		provider,
	}

	for i, metricDefinition := range metricDefinitionArray {
		urlArray = append(urlArray, metricDefinition, resourceNameArray[i])
	}

	resourceURI := strings.Join(urlArray, "/")
	return resourceURI
}

// BuildMetricsURL checks the metric definition property to see which form of the url
// should be returned
func (params *urlBuilder) BuildMetricsURL() string {
	resourceURI := params.ResourceURI

	// Prior to Grafana 9, we had a legacy query object rather than a resourceURI, so we manually create the resource URI
	if resourceURI == "" {
		resourceURI = params.buildResourceURIFromLegacyQuery()
	}

	return fmt.Sprintf("%s/providers/microsoft.insights/metrics", resourceURI)
}
