package metrics

import (
	"fmt"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func MigrateDimensionFilters(filters []types.AzureMonitorDimensionFilter) []types.AzureMonitorDimensionFilter {
	fmt.Println(filters)
	var newFilters []types.AzureMonitorDimensionFilter
	fmt.Println(newFilters)
	for _, filter := range filters {
		newFilter := filter
		newFilter.Filter = nil
		// If there is no old field and the new field is specified - append as this is valid
		if filter.Filter == nil && filter.Filters != nil {
			newFilters = append(newFilters, newFilter)
		} else {
			oldFilter := *filter.Filter
			// If there is an old filter and no new ones then construct the new array and append
			if filter.Filters == nil {
				if oldFilter != "*" {
					newFilter.Filters = []string{oldFilter}
				}
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
	fmt.Println(newFilters)
	return newFilters
}
