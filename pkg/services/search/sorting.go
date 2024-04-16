package search

import (
	"sort"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

var (
	SortAlphaAsc = model.SortOption{
		Name:        "alpha-asc",
		DisplayName: "Alphabetically (A-Z)",
		Description: "Sort results in an alphabetically ascending order",
		Index:       0,
		Filter: []model.SortOptionFilter{
			searchstore.TitleSorter{},
		},
	}
	SortAlphaDesc = model.SortOption{
		Name:        "alpha-desc",
		DisplayName: "Alphabetically (Z-A)",
		Description: "Sort results in an alphabetically descending order",
		Index:       1,
		Filter: []model.SortOptionFilter{
			searchstore.TitleSorter{Descending: true},
		},
	}
	SortCreatedDesc = model.SortOption{
		Name:        "created-desc",
		DisplayName: "Newest",
		Description: "Sort results by time of creation",
		Index:       2,
		Filter: []model.SortOptionFilter{
			searchstore.DateCreatedSorter{Descending: true},
		},
	}
	SortCreatedAsc = model.SortOption{
		Name:        "created-asc",
		DisplayName: "Oldest",
		Description: "Sort results by time of creation, oldest first",
		Index:       3,
		Filter: []model.SortOptionFilter{
			searchstore.DateCreatedSorter{},
		},
	}
	SortUpdatedDesc = model.SortOption{
		Name:        "updated-desc",
		DisplayName: "Recently updated",
		Description: "Sort results by the time of their most recent update",
		Index:       4,
		Filter: []model.SortOptionFilter{
			searchstore.DateUpdatedSorter{Descending: true},
		},
	}
	SortUpdatedAsc = model.SortOption{
		Name:        "updated-asc",
		DisplayName: "Least recently updated",
		Description: "Sort results by the time of their most recent update, oldest first",
		Index:       5,
		Filter: []model.SortOptionFilter{
			searchstore.DateUpdatedSorter{},
		},
	}
)

// RegisterSortOption allows for hooking in more search options from
// other services.
func (s *SearchService) RegisterSortOption(option model.SortOption) {
	s.sortOptions[option.Name] = option
}

func (s *SearchService) SortOptions() []model.SortOption {
	opts := make([]model.SortOption, 0, len(s.sortOptions))
	for _, o := range s.sortOptions {
		opts = append(opts, o)
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
	})
	return opts
}
