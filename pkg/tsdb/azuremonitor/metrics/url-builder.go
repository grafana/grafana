package metrics

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azlog"
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
