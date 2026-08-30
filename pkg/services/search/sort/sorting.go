package sort

import (
	"fmt"
	"sort"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var sortByMapping = map[string]string{
	builders.DASHBOARD_VIEWS_LAST_30_DAYS:  "viewed-recently",
	builders.DASHBOARD_VIEWS_TOTAL:         "viewed",
	builders.DASHBOARD_ERRORS_LAST_30_DAYS: "errors-recently",
	builders.DASHBOARD_ERRORS_TOTAL:        "errors",
	"title":                                "alpha",
}

func ParseSortName(sortName string) (string, bool, error) {
	if sortName == "" {
		return "", false, nil
	}

	isDesc := strings.HasSuffix(sortName, "-desc")
	isAsc := strings.HasSuffix(sortName, "-asc")
	if !isDesc && !isAsc {
		isDesc = true
	}

	prefix := strings.TrimSuffix(strings.TrimSuffix(sortName, "-desc"), "-asc")
	for key, mappedPrefix := range sortByMapping {
		if prefix == mappedPrefix {
			return key, isDesc, nil
		}
	}

	return "", false, apierrors.NewBadRequest(fmt.Sprintf("no matching sort field found for: %s", sortName))
}

var (
	SortAlphaAsc = model.SortOption{
		Name:        "alpha-asc",
		DisplayName: "Alphabetically (A–Z)",
		Description: "Sort results in an alphabetically ascending order",
		Index:       0,
		Filter: []model.SortOptionFilter{
			model.TitleSorter{},
		},
	}
	SortAlphaDesc = model.SortOption{
		Name:        "alpha-desc",
		DisplayName: "Alphabetically (Z–A)",
		Description: "Sort results in an alphabetically descending order",
		Index:       0,
		Filter: []model.SortOptionFilter{
			model.TitleSorter{Descending: true},
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
