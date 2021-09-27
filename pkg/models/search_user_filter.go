package models

import "github.com/grafana/grafana/pkg/infra/log"

type SearchUserFilter interface {
	GetFilter(filterName string, params []string) Filter
	GetFilterList() map[string]FilterHandler
}

type WhereCondition struct {
	Condition string
	Params    interface{}
}

type InCondition struct {
	Condition string
	Params    interface{}
}

type JoinCondition struct {
	Operator string
	Table    string
	Params   string
}

type FilterHandler func(params []string) (Filter, error)

type Filter interface {
	WhereCondition() *WhereCondition
	InCondition() *InCondition
	JoinCondition() *JoinCondition
}

type OSSSearchUserFilter struct {
	filterList []FilterHandler
	filters    map[string]FilterHandler
}

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	return &OSSSearchUserFilter{
		filters: make(map[string]FilterHandler, 0),
	}
}

func (o *OSSSearchUserFilter) GetFilter(filterName string, params []string) Filter {
	f, ok := o.filters[filterName]
	if ok && len(params) > 0 {
		filter, err := f(params)
		if err != nil {
			log.Warnf("Cannot initialise the filter %s: %s", filterName, err)
			return nil
		}
		return filter
	}
	return nil
}

func (o *OSSSearchUserFilter) GetFilterList() map[string]FilterHandler {
	return o.filters
}
