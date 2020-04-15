package search

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"sort"
)

var (
	sortAlphaAsc = SortOption{
		Name:        "alpha-asc",
		DisplayName: "A-Z",
		Description: "Sort results in an alphabetically ascending order",
		Filter:      searchstore.TitleSorter{},
	}
	sortAlphaDesc = SortOption{
		Name:        "alpha-desc",
		DisplayName: "Z-A",
		Description: "Sort results in an alphabetically descending order",
		Filter:      searchstore.TitleSorter{Descending: true},
	}
)

type SortOption struct {
	Name        string
	DisplayName string
	Description string
	Filter      searchstore.FilterOrderBy
}

var sortOptions = map[string]SortOption{
	sortAlphaAsc.Name:  sortAlphaAsc,
	sortAlphaDesc.Name: sortAlphaDesc,
}

func RegisterSortOption(option SortOption) {
	sortOptions[option.Name] = option
}

func SortOptions() []SortOption {
	opts := make([]SortOption, 0, len(sortOptions))
	for _, o := range sortOptions {
		opts = append(opts, o)
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Name < opts[j].Name
	})
	return opts
}
