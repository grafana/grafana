package metrics

import "github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"

func MigrateDimensionFilters(filters []dataquery.AzureMetricDimension) []dataquery.AzureMetricDimension {
	var newFilters []dataquery.AzureMetricDimension
	for _, filter := range filters {
		newFilter := filter
		// Ignore the deprecation check as this is a migration
		// nolint:staticcheck
		newFilter.Filter = nil
		// If there is no deprecated single-value filter there is nothing to
		// migrate, so keep the (possibly empty or nil) Filters slice as-is.
		// Guarding on Filter alone also avoids a nil-pointer dereference below
		// when a dimension has neither Filter nor Filters set - which happens in
		// the batch flow when an empty Filters slice is dropped by `omitempty`
		// during the cloneQueryWithResources JSON round-trip.
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
