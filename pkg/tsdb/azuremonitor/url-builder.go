package azuremonitor

import (
	"fmt"
	"strings"
)

// urlBuilder builds the URL for calling the Azure Monitor API
type urlBuilder struct {
	ResourceGroup    string
	MetricDefinition string
	ResourceName     string
}

// Build checks the metric definition property to see which form of the url
// should be returned
func (ub *urlBuilder) Build() string {

	if strings.Count(ub.MetricDefinition, "/") > 1 {
		rn := strings.Split(ub.ResourceName, "/")
		lastIndex := strings.LastIndex(ub.MetricDefinition, "/")
		service := ub.MetricDefinition[lastIndex+1:]
		md := ub.MetricDefinition[0:lastIndex]
		return fmt.Sprintf("resourceGroups/%s/providers/%s/%s/%s/%s/providers/microsoft.insights/metrics", ub.ResourceGroup, md, rn[0], service, rn[1])
	}

	return fmt.Sprintf("resourceGroups/%s/providers/%s/%s/providers/microsoft.insights/metrics", ub.ResourceGroup, ub.MetricDefinition, ub.ResourceName)
}
