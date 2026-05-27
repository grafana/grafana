package azuremonitor

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// azureMonitorSQLMaxResourcesPerQuery caps Resource Graph discovery for Grafana SQL queries that
// omit resourceName (resource group scope). If more resources match, the query fails with a clear error.
const azureMonitorSQLMaxResourcesPerQuery = 20

// discoverResourcesForAzureMonitorSQL lists resources of the given metric namespace in a resource group
// via Azure Resource Graph, ordered by name. Returns at most azureMonitorSQLMaxResourcesPerQuery entries;
// if more would match, returns an error.
func discoverResourcesForAzureMonitorSQL(ctx context.Context, dsInfo types.DatasourceInfo, subscription, resourceGroup, metricNamespace string) ([]dataquery.AzureMonitorResource, error) {
	nsEsc := strings.ReplaceAll(metricNamespace, `'`, `\'`)
	rgEsc := strings.ReplaceAll(resourceGroup, `'`, `\'`)
	kql := fmt.Sprintf(
		"Resources | where type =~ '%s' | where resourceGroup =~ '%s' | project name, resourceGroup | order by name asc | take %d",
		nsEsc, rgEsc, azureMonitorSQLMaxResourcesPerQuery+1,
	)
	table, err := runResourceGraphQuery(ctx, dsInfo, subscription, kql)
	if err != nil {
		return nil, err
	}

	nameIdx, rgIdx := -1, -1
	for i, c := range table.Columns {
		switch strings.ToLower(strings.TrimSpace(c.Name)) {
		case "name":
			nameIdx = i
		case "resourcegroup":
			rgIdx = i
		}
	}
	if nameIdx < 0 || rgIdx < 0 {
		return nil, fmt.Errorf("azure monitor sql: unexpected resource graph response (missing name/resourceGroup columns)")
	}

	if len(table.Rows) == 0 {
		return nil, fmt.Errorf("azure monitor sql: no resources found for metric namespace %q in resource group %q", metricNamespace, resourceGroup)
	}
	if len(table.Rows) > azureMonitorSQLMaxResourcesPerQuery {
		return nil, fmt.Errorf(
			"azure monitor sql: too many resources in resource group %q (found at least %d, max %d); narrow with resourceName or split the query",
			resourceGroup, len(table.Rows), azureMonitorSQLMaxResourcesPerQuery,
		)
	}

	subCopy := subscription
	nsCopy := metricNamespace
	out := make([]dataquery.AzureMonitorResource, 0, len(table.Rows))
	for _, row := range table.Rows {
		if len(row) <= nameIdx || len(row) <= rgIdx {
			continue
		}
		rn := strings.TrimSpace(fmt.Sprint(row[nameIdx]))
		rgg := strings.TrimSpace(fmt.Sprint(row[rgIdx]))
		if rn == "" {
			continue
		}
		res := dataquery.AzureMonitorResource{
			Subscription:    &subCopy,
			ResourceGroup:   &rgg,
			ResourceName:    &rn,
			MetricNamespace: &nsCopy,
		}
		out = append(out, res)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("azure monitor sql: no resources found for metric namespace %q in resource group %q", metricNamespace, resourceGroup)
	}
	return out, nil
}
