package filters

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

const activeLast30Days = "activeLast30Days"

type OSSSearchUserFilter struct {
	filters map[string]user.FilterHandler
}

var fltlog = log.New("filters")

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	filters := make(map[string]user.FilterHandler)
	filters[activeLast30Days] = NewActiveLast30DaysFilter
	return &OSSSearchUserFilter{
		filters: filters,
	}
}

func (o *OSSSearchUserFilter) GetFilter(filterName string, params []string) user.Filter {
	f, ok := o.filters[filterName]
	if !ok || len(params) == 0 {
		return nil
	}
	filter, err := f(params)
	if err != nil {
		fltlog.Warn("Cannot initialise the filter.", "filter", filterName, "error", err)
		return nil
	}
	return filter
}

func (o *OSSSearchUserFilter) GetFilterList() map[string]user.FilterHandler {
	return o.filters
}
