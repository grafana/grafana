package models

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

const activeLast30Days = "activeLast30Days"

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
	filters map[string]FilterHandler
}

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	filters := make(map[string]FilterHandler)
	filters[activeLast30Days] = NewActiveLast30DaysFilter
	return &OSSSearchUserFilter{
		filters: filters,
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

type ActiveLast30DaysFilter struct {
	active bool
}

func NewActiveLast30DaysFilter(params []string) (Filter, error) {
	active, err := strconv.ParseBool(params[0])
	if err != nil {
		return nil, err
	}
	return &ActiveLast30DaysFilter{active: active}, nil
}

func (a *ActiveLast30DaysFilter) WhereCondition() *WhereCondition {
	if !a.active {
		return nil
	}
	return &WhereCondition{
		Condition: "last_seen_at > ?",
		Params:    a.whereParams(),
	}
}

func (a *ActiveLast30DaysFilter) JoinCondition() *JoinCondition {
	return nil
}

func (a *ActiveLast30DaysFilter) InCondition() *InCondition {
	return nil
}

func (a *ActiveLast30DaysFilter) whereParams() interface{} {
	activeUserTimeLimit := time.Hour * 24 * 30
	return time.Now().Add(-activeUserTimeLimit)
}
