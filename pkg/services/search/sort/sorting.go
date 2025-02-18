package sort

import (
	"sort"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// sort is separated into its own service to allow the dashboard service to use it in the k8s
// fallback (see pkg/registry/apis/dashboard/legacysearcher/search_client.go), since search
// has a direct dependency on the dashboard service (and thus would create a circular dependency in wire)

var (
	SortAlphaAsc = model.SortOption{
		Name:        "alpha-asc",
		DisplayName: "Alphabetically (A–Z)",
		Description: "Sort results in an alphabetically ascending order",
		Index:       0,
		Filter: []model.SortOptionFilter{
			searchstore.TitleSorter{},
		},
	}
	SortAlphaDesc = model.SortOption{
		Name:        "alpha-desc",
		DisplayName: "Alphabetically (Z–A)",
		Description: "Sort results in an alphabetically descending order",
		Index:       0,
		Filter: []model.SortOptionFilter{
			searchstore.TitleSorter{Descending: true},
		},
	}
)

type Service struct {
	sortOptions map[string]model.SortOption
}

func ProvideService() Service {
	return Service{
		sortOptions: map[string]model.SortOption{
			SortAlphaAsc.Name:  SortAlphaAsc,
			SortAlphaDesc.Name: SortAlphaDesc,
		},
	}
}

// RegisterSortOption allows for hooking in more search options from
// other services.
func (s *Service) RegisterSortOption(option model.SortOption) {
	s.sortOptions[option.Name] = option
}

func (s *Service) SortOptions() []model.SortOption {
	opts := make([]model.SortOption, 0, len(s.sortOptions))
	for _, o := range s.sortOptions {
		opts = append(opts, o)
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
	})
	return opts
}

func (s *Service) GetSortOption(sort string) (model.SortOption, bool) {
	option, ok := s.sortOptions[sort]
	return option, ok
}
