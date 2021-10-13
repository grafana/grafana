package filters

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

const activeLast30Days = "activeLast30Days"

type OSSSearchUserFilter struct {
	filters map[string]models.FilterHandler
}

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	filters := make(map[string]models.FilterHandler)
	filters[activeLast30Days] = NewActiveLast30DaysFilter
	return &OSSSearchUserFilter{
		filters: filters,
	}
}

func (o *OSSSearchUserFilter) GetFilter(filterName string, params []string) models.Filter {
	f, ok := o.filters[filterName]
	if !ok || len(params) == 0 {
		return nil
	}
	filter, err := f(params)
	if err != nil {
		log.Warnf("Cannot initialise the filter %s: %s", filterName, err)
		return nil
	}
	return filter
}

func (o *OSSSearchUserFilter) GetFilterList() map[string]models.FilterHandler {
	return o.filters
}
