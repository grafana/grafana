package metrics

import "github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"

func MigrateDimensionFilters(filters []dataquery.AzureMetricDimension) []dataquery.AzureMetricDimension {
	newFilters := []dataquery.AzureMetricDimension{}
	for _, filter := range filters {
		// Drop filters without dimension
		if filter.Dimension == nil {
			continue
		}

		newFilter := filter
		// Ignore the deprecation check as this is a migration
		// nolint:staticcheck
		newFilter.Filter = nil
		// If there is no legacy filter field, there is nothing to migrate, append as-is
		// nolint:staticcheck
		if filter.Filter == nil {
			newFilters = append(newFilters, newFilter)
		} else {
			// nolint:staticcheck
			oldFilter := *filter.Filter
			// If there is an old filter and no new ones then construct the new array and append
			if filter.Filters == nil && oldFilter != "*" {
				newFilter.Filters = []string{oldFilter}
				// If both the new and old fields are specified (edge case) then construct the appropriate values
			} else {
				hasFilter := false
				oldFilters := filter.Filters
				for _, filterValue := range oldFilters {
					if filterValue == oldFilter {
						hasFilter = true
						break
					}
				}
				if !hasFilter && oldFilter != "*" {
					oldFilters = append(oldFilters, oldFilter)
					newFilter.Filters = oldFilters
				}
			}
			newFilters = append(newFilters, newFilter)
		}
	}
	return newFilters
}
