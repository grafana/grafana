package legacysort

import (
	"fmt"
	"sort"
	"strings"

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

// ConvertToSortParams translates legacy SQL sort options into K8s search sort query parameters.
// fieldMapping is the same unified→legacy map used in ConvertToSortOptions (e.g. "title" to "name", "fields.email" to "email").
// It is reversed internally, stripping the "fields." prefix to produce bare K8s sort param names.
// Sort options that cannot be mapped (e.g. member_count) are silently skipped.
func ConvertToSortParams(
	sortOpts []model.SortOption,
	fieldMapping map[string]string,
) []string {
	// Build reverse mapping: legacy sort key to K8s sort param field name
	reverseMapping := make(map[string]string, len(fieldMapping))
	for unified, legacy := range fieldMapping {
		reverseMapping[legacy] = strings.TrimPrefix(unified, "fields.")
	}

	params := make([]string, 0, len(sortOpts))
	for _, opt := range sortOpts {
		parts := strings.SplitN(opt.Name, "-", 2)
		if len(parts) != 2 {
			continue
		}

		k8sField, ok := reverseMapping[parts[0]]
		if !ok {
			continue
		}

		param := k8sField
		if parts[1] == "desc" {
			param = "-" + param
		}
		params = append(params, param)
	}
	return params
}
