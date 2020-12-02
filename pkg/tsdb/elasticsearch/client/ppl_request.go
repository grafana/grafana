package es

import (
	"fmt"
	"strings"
)

// PPLFilterQueryBuilder represents a PPL query builder
type PPLQueryBuilder struct {
	index    string
	pplQuery string
}

// NewPPLQueryBuilder create a new PPL query builder
func NewPPLQueryBuilder(index string) *PPLQueryBuilder {
	builder := &PPLQueryBuilder{
		index: index,
	}
	return builder
}

// Build builds and return a PPL query object
func (b *PPLQueryBuilder) Build() (*PPLQuery, error) {
	if b == nil {
		b = NewPPLQueryBuilder(b.index)
	}

	return &PPLQuery{
		Query: b.pplQuery,
	}, nil
}

// AddPPLQueryString adds a new PPL query string with time range filter
func (b *PPLQueryBuilder) AddPPLQueryString(timeField, lte, gte, querystring string) *PPLQueryBuilder {
	res := []string{}
	timeFilter := fmt.Sprintf(" where `%s` > timestamp('%s') and `%s` < timestamp('%s')", timeField, lte, timeField, gte)

	// Sets a default query if the query string is empty
	if len(strings.TrimSpace(querystring)) == 0 {
		querystring = fmt.Sprintf("source = %s", b.index)
	}

	// Time range filter always come right after the source=[index]
	querySplit := strings.SplitN(querystring, "|", 2)
	if len(querySplit) == 1 {
		res = []string{strings.TrimSpace(querySplit[0]), timeFilter}
	} else {
		res = []string{strings.TrimSpace(querySplit[0]), timeFilter, querySplit[1]}
	}
	b.pplQuery = strings.Join(res, " |")
	return b
}
