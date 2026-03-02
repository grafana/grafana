package es

import (
	"strings"
)

// QueryBuilder represents a query builder
type QueryBuilder struct {
	boolQueryBuilder *BoolQueryBuilder
}

// NewQueryBuilder create a new query builder
func NewQueryBuilder() *QueryBuilder {
	return &QueryBuilder{}
}

// Build builds and return a query builder
func (b *QueryBuilder) Build() (*Query, error) {
	q := Query{}

	if b.boolQueryBuilder != nil {
		b, err := b.boolQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		q.Bool = b
	}

	return &q, nil
}

// Bool creates and return a query builder
func (b *QueryBuilder) Bool() *BoolQueryBuilder {
	if b.boolQueryBuilder == nil {
		b.boolQueryBuilder = NewBoolQueryBuilder()
	}
	return b.boolQueryBuilder
}

// BoolQueryBuilder represents a bool query builder
type BoolQueryBuilder struct {
	filterQueryBuilder *FilterQueryBuilder
}

// NewBoolQueryBuilder create a new bool query builder
func NewBoolQueryBuilder() *BoolQueryBuilder {
	return &BoolQueryBuilder{}
}

// Filter creates and return a filter query builder
func (b *BoolQueryBuilder) Filter() *FilterQueryBuilder {
	if b.filterQueryBuilder == nil {
		b.filterQueryBuilder = NewFilterQueryBuilder()
	}
	return b.filterQueryBuilder
}

// Build builds and return a bool query builder
func (b *BoolQueryBuilder) Build() (*BoolQuery, error) {
	boolQuery := BoolQuery{}

	if b.filterQueryBuilder != nil {
		filters, err := b.filterQueryBuilder.Build()
		if err != nil {
			return nil, err
		}
		boolQuery.Filters = filters
	}

	return &boolQuery, nil
}

// FilterQueryBuilder represents a filter query builder
type FilterQueryBuilder struct {
	filters []Filter
}

// NewFilterQueryBuilder creates a new filter query builder
func NewFilterQueryBuilder() *FilterQueryBuilder {
	return &FilterQueryBuilder{
		filters: make([]Filter, 0),
	}
}

// Build builds and return a filter query builder
func (b *FilterQueryBuilder) Build() ([]Filter, error) {
	return b.filters, nil
}

// AddDateRangeFilter adds a new time range filter
func (b *FilterQueryBuilder) AddDateRangeFilter(timeField string, lte, gte int64, format string) *FilterQueryBuilder {
	b.filters = append(b.filters, &RangeFilter{
		Key:    timeField,
		Lte:    lte,
		Gte:    gte,
		Format: format,
	})
	return b
}

// AddQueryStringFilter adds a new query string filter
func (b *FilterQueryBuilder) AddQueryStringFilter(querystring string, analyseWildcard bool) *FilterQueryBuilder {
	if len(strings.TrimSpace(querystring)) == 0 {
		return b
	}

	b.filters = append(b.filters, &QueryStringFilter{
		Query:           querystring,
		AnalyzeWildcard: analyseWildcard,
	})
	return b
}
