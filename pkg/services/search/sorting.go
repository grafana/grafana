package search

import (
	"sort"

	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

var (
	sortAlphaAsc = SortOption{
		Name:        "alpha-asc",
		DisplayName: "Alphabetically (A-Z)",
		Description: "Sort results in an alphabetically ascending order",
		Filter: []SortOptionFilter{
			searchstore.TitleSorter{},
		},
	}
	sortAlphaDesc = SortOption{
		Name:        "alpha-desc",
		DisplayName: "Alphabetically (Z-A)",
		Description: "Sort results in an alphabetically descending order",
		Filter: []SortOptionFilter{
			searchstore.TitleSorter{Descending: true},
		},
	}
)

type SortOption struct {
	Name        string
	DisplayName string
	Description string
	Filter      []SortOptionFilter
}

type SortOptionFilter interface {
	searchstore.FilterOrderBy
}

// RegisterSortOption allows for hooking in more search options from
// other services.
func (s *SearchService) RegisterSortOption(option SortOption) {
	s.sortOptions[option.Name] = option
}

func (s *SearchService) SortOptions() []SortOption {
	opts := make([]SortOption, 0, len(s.sortOptions))
	for _, o := range s.sortOptions {
		opts = append(opts, o)
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Name < opts[j].Name
	})
	return opts
}
