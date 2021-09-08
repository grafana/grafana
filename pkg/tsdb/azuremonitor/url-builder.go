package azuremonitor

import (
	"fmt"
	"strings"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	ResourceURI string

	// Following fields are deprecated and are not included in new queries.
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

	// We have a legacy query from before the resource picker, so we manually create the resource URI
	if resourceURI == "" {
		azlog.Info("Detected legacy query without a resource URI")
		subscription := params.Subscription

		if params.Subscription == "" {
			subscription = params.DefaultSubscription
		}

		urlArray := []string{
			"/subscriptions",
			subscription,
			"resourceGroups",
			params.ResourceGroup,
			"providers",
			params.MetricDefinition, // resource type
			params.ResourceName,
		}

		resourceURI = strings.Join(urlArray[:], "/")
	}

	return fmt.Sprintf("%s/providers/microsoft.insights/metrics", resourceURI)
}
