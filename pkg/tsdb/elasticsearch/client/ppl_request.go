package es

import (
	"fmt"
	"strings"
)

// PPLRequestBuilder represents a PPL request builder
type PPLRequestBuilder struct {
	index    string
	pplQuery string
}

// NewPPLRequestBuilder create a new PPL request builder
func NewPPLRequestBuilder(index string) *PPLRequestBuilder {
	builder := &PPLRequestBuilder{
		index: index,
	}
	return builder
}

// Build builds and return a PPL query object
func (b *PPLRequestBuilder) Build() (*PPLRequest, error) {
	return &PPLRequest{
		Query: b.pplQuery,
	}, nil
}

// AddPPLQueryString adds a new PPL query string with time range filter
func (b *PPLRequestBuilder) AddPPLQueryString(timeField, to, from, querystring string) *PPLRequestBuilder {
	res := []string{}
	timeFilter := fmt.Sprintf(" where `%s` >= timestamp('%s') and `%s` <= timestamp('%s')", timeField, from, timeField, to)

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
