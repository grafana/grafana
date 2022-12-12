package metrics

import (
	"fmt"
	"strings"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	ResourceURI string

	// Following fields will be used to generate a ResourceURI
	DefaultSubscription string
	Subscription        string
	ResourceGroup       string
	MetricNamespace     string
	ResourceName        string
}

func (params *urlBuilder) buildResourceURI() string {
	if params.ResourceURI != "" {
		return params.ResourceURI
	}

	subscription := params.Subscription

	if params.Subscription == "" {
		subscription = params.DefaultSubscription
	}

	metricNamespaceArray := strings.Split(params.MetricNamespace, "/")
	resourceNameArray := strings.Split(params.ResourceName, "/")
	provider := metricNamespaceArray[0]
	metricNamespaceArray = metricNamespaceArray[1:]

	if strings.HasPrefix(strings.ToLower(params.MetricNamespace), "microsoft.storage/storageaccounts/") &&
		!strings.HasSuffix(params.ResourceName, "default") {
		resourceNameArray = append(resourceNameArray, "default")
	}

	urlArray := []string{
		"/subscriptions",
		subscription,
		"resourceGroups",
		params.ResourceGroup,
		"providers",
		provider,
	}

	for i, namespace := range metricNamespaceArray {
		urlArray = append(urlArray, namespace, resourceNameArray[i])
	}

	resourceURI := strings.Join(urlArray, "/")
	return resourceURI
}

// BuildMetricsURL checks the metric properties to see which form of the url
// should be returned
func (params *urlBuilder) BuildMetricsURL() string {
	resourceURI := params.ResourceURI

	// Prior to Grafana 9, we had a legacy query object rather than a resourceURI, so we manually create the resource URI
	if resourceURI == "" {
		resourceURI = params.buildResourceURI()
	}

	return fmt.Sprintf("%s/providers/microsoft.insights/metrics", resourceURI)
}

// BuildSubscriptionMetricsURL returns a URL for querying metrics for all resources in a subscription
// It requires to set a $filter and a region parameter
func BuildSubscriptionMetricsURL(subscription string) string {
	return fmt.Sprintf("/subscriptions/%s/providers/microsoft.insights/metrics", subscription)
}
