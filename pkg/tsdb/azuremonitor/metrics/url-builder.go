package metrics

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	ResourceURI *string

	// Following fields will be used to generate a ResourceURI
	DefaultSubscription *string
	Subscription        *string
	ResourceGroup       *string
	MetricNamespace     *string
	ResourceName        *string
	MetricDefinition    *string
}

func (params *urlBuilder) buildResourceURI() (*string, error) {
	if params.ResourceURI != nil && *params.ResourceURI != "" {
		return params.ResourceURI, nil
	}

	subscription := params.Subscription

	if params.Subscription == nil || *params.Subscription == "" {
		subscription = params.DefaultSubscription
	}

	metricNamespace := params.MetricNamespace

	if metricNamespace == nil || *metricNamespace == "" {
		if params.MetricDefinition == nil || *params.MetricDefinition == "" {
			return nil, errorsource.DownstreamError(fmt.Errorf("no metricNamespace or metricDefiniton value provided"), false)
		}
		metricNamespace = params.MetricDefinition
	}

	metricNamespaceArray := strings.Split(*metricNamespace, "/")

	provider := ""
	if len(metricNamespaceArray) > 1 {
		provider = metricNamespaceArray[0]
		metricNamespaceArray = metricNamespaceArray[1:]
	} else {
		return nil, errorsource.DownstreamError(fmt.Errorf("metricNamespace is not in the correct format"), false)
	}

	var resourceNameArray []string
	if params.ResourceName != nil && *params.ResourceName != "" {
		resourceNameArray = strings.Split(*params.ResourceName, "/")
	}

	if strings.HasPrefix(strings.ToLower(*metricNamespace), "microsoft.storage/storageaccounts/") &&
		params.ResourceName != nil &&
		!strings.HasSuffix(*params.ResourceName, "default") {
		resourceNameArray = append(resourceNameArray, "default")
	}

	resGroup := ""
	if params.ResourceGroup != nil {
		resGroup = *params.ResourceGroup
	}
	urlArray := []string{
		"/subscriptions",
		*subscription,
		"resourceGroups",
		resGroup,
		"providers",
		provider,
	}

	for i, namespace := range metricNamespaceArray {
		if i < len(resourceNameArray) {
			urlArray = append(urlArray, namespace, resourceNameArray[i])
		} else {
			return nil, errorsource.DownstreamError(fmt.Errorf("resourceNameArray does not have enough elements"), false)
		}
	}

	resourceURI := strings.Join(urlArray, "/")
	return &resourceURI, nil
}

// BuildSubscriptionMetricsURL returns a URL for querying metrics for all resources in a subscription
// It requires to set a $filter and a region parameter
func BuildSubscriptionMetricsURL(subscription string) string {
	return fmt.Sprintf("/subscriptions/%s/providers/microsoft.insights/metrics", subscription)
}
