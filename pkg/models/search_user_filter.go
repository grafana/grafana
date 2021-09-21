package models

import (
	"strings"
	"time"
)

type SearchUserFilter interface {
	GetFilters(filter string) []Filter
	GetFilterList() map[string]Filter
}

type WhereCondition struct {
	Condition string
	Params    interface{}
}

type JoinCondition struct {
	Operator string
	Table    string
	Params   string
}

type Filter interface {
	WhereCondition() *WhereCondition
	JoinCondition() *JoinCondition
}

type ActiveLast30DaysFilter struct {
}

func (a ActiveLast30DaysFilter) WhereCondition() *WhereCondition {
	return &WhereCondition{
		Condition: "last_seen_at > ?",
		Params:    a.whereParams(),
	}
}

func (a ActiveLast30DaysFilter) JoinCondition() *JoinCondition {
	return nil
}

func (a ActiveLast30DaysFilter) whereParams() interface{} {
	activeUserTimeLimit := time.Hour * 24 * 30
	return time.Now().Add(-activeUserTimeLimit)
}

const (
	activeLast30Days = "activeLast30Days"
)

type OSSSearchUserFilter struct {
	filters map[string]Filter
}

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	filters := make(map[string]Filter, 0)
	filters[activeLast30Days] = ActiveLast30DaysFilter{}
	return &OSSSearchUserFilter{
		filters: filters,
	}
}

func (o *OSSSearchUserFilter) GetFilters(filters string) []Filter {
	filterSplit := strings.Split(filters, ",")
	filterList := make([]Filter, 0)
	for _, fs := range filterSplit {
		if f, ok := o.filters[fs]; ok {
			filterList = append(filterList, f)
		}
	}
	return filterList
}

func (o *OSSSearchUserFilter) GetFilterList() map[string]Filter {
	return o.filters
}
