package legacysort

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// ConvertToSortOptions translates unified search sort fields into legacy SQL sort options.
// fieldMapping maps unified field names (e.g. "title", "fields.email") to legacy sort key names (e.g. "name", "email").
// sortOptions is the resource-specific SortOptionsByQueryParam map.
func ConvertToSortOptions(
	sortBy []*resourcepb.ResourceSearchRequest_Sort,
	fieldMapping map[string]string,
	sortOptions map[string]model.SortOption,
) []model.SortOption {
	opts := []model.SortOption{}
	for _, s := range sortBy {
		field := s.Field
		if mapped, ok := fieldMapping[field]; ok {
			field = mapped
		}

		suffix := "asc"
		if s.Desc {
			suffix = "desc"
		}
		key := fmt.Sprintf("%s-%s", field, suffix)

		if opt, ok := sortOptions[key]; ok {
			opts = append(opts, opt)
		}
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
	})
	return opts
}
