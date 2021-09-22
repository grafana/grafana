package models

import (
	"strings"
)

type SearchUserFilter interface {
	GetFilters(filters string) []Filter
	GetFilterList() map[string]Filter
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

type Filter interface {
	WhereCondition() *WhereCondition
	InCondition() *InCondition
	JoinCondition() *JoinCondition
	SetParams(params []string)
}

type OSSSearchUserFilter struct {
	filters map[string]Filter
}

func ProvideOSSSearchUserFilter() *OSSSearchUserFilter {
	return &OSSSearchUserFilter{
		filters: make(map[string]Filter, 0),
	}
}

func (o *OSSSearchUserFilter) GetFilters(filters string) []Filter {
	filtersRequested := strings.Split(filters, ",")
	filtersFound := make([]Filter, 0)
	filterWithParams := make(map[Filter][]string)
	for _, fr := range filtersRequested {
		if f, ok := o.filters[fr]; ok {
			if _, ok = filterWithParams[f]; !ok {
				filtersFound = append(filtersFound, f)
			}
			filterWithParams[f] = append(filterWithParams[f], fr)
		}
	}
	for f, p := range filterWithParams {
		f.SetParams(p)
	}
	return filtersFound
}

func (o *OSSSearchUserFilter) GetFilterList() map[string]Filter {
	return o.filters
}
