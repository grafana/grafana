// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"
	"fmt"
	u "github.com/araddon/gou"
	"strconv"
	"strings"
)

var (
	_ = u.DEBUG
)

// Search is the entry point to the SearchDsl, it is a chainable set of utilities
// to create searches.
//
// params
//    @index = elasticsearch index to search
//
//    out, err := Search("github").Type("Issues").Pretty().Query(
//    Query().Range(
//         Range().Field("created_at").From("2012-12-10T15:00:00-08:00").To("2012-12-10T15:10:00-08:00"),
//       ).Search("add"),
//     ).Result()
func Search(index string) *SearchDsl {
	return &SearchDsl{Index: index, args: map[string]interface{}{}}
}

type SearchDsl struct {
	args          map[string]interface{}
	types         []string
	FromVal       int                      `json:"from,omitempty"`
	SizeVal       int                      `json:"size,omitempty"`
	Index         string                   `json:"-"`
	FacetVal      *FacetDsl                `json:"facets,omitempty"`
	QueryVal      *QueryDsl                `json:"query,omitempty"`
	SortBody      []*SortDsl               `json:"sort,omitempty"`
	FilterVal     *FilterWrap              `json:"filter,omitempty"`
	AggregatesVal map[string]*AggregateDsl `json:"aggregations,omitempty"`
}

func (s *SearchDsl) Bytes(conn *Conn) ([]byte, error) {
	return conn.DoCommand("POST", s.url(), s.args, s)
}

func (s *SearchDsl) Result(conn *Conn) (*SearchResult, error) {
	var retval SearchResult
	body, err := s.Bytes(conn)
	retval.RawJSON = body
	if err != nil {
		u.Errorf("%v", err)
		return nil, err
	}
	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		u.Errorf("%v \n\t%s", jsonErr, string(body))
	}
	return &retval, jsonErr
}

func (s *SearchDsl) url() string {
	url := fmt.Sprintf("/%s%s/_search", s.Index, s.getType())
	return url
}

func (s *SearchDsl) Pretty() *SearchDsl {
	s.args["pretty"] = "1"
	return s
}

// Type is the elasticsearch *Type* within a specific index
func (s *SearchDsl) Type(indexType string) *SearchDsl {
	if len(s.types) == 0 {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, indexType)
	return s
}

func (s *SearchDsl) getType() string {
	if len(s.types) > 0 {
		return "/" + strings.Join(s.types, ",")
	}
	return ""
}

func (s *SearchDsl) From(from string) *SearchDsl {
	s.args["from"] = from
	return s
}

// Search is a simple interface to search, doesn't have the power of query
// but uses a simple query_string search
func (s *SearchDsl) Search(srch string) *SearchDsl {
	s.QueryVal = Query().Search(srch)
	return s
}

func (s *SearchDsl) Size(size string) *SearchDsl {
	s.args["size"] = size
	return s
}

func (s *SearchDsl) Fields(fields ...string) *SearchDsl {
	s.args["fields"] = strings.Join(fields, ",")
	return s
}

func (s *SearchDsl) Source(returnSource bool) *SearchDsl {
	s.args["_source"] = strconv.FormatBool(returnSource)
	return s
}

// Facet passes a Query expression to this search
//
//		qry := Search("github").Size("0").Facet(
//					Facet().Regex("repository.name", "no.*").Size("8"),
//				)
//
//		qry := Search("github").Pretty().Facet(
//					Facet().Fields("type").Size("25"),
//				)
func (s *SearchDsl) Facet(f *FacetDsl) *SearchDsl {
	s.FacetVal = f
	return s
}

func (s *SearchDsl) Aggregates(aggs ...*AggregateDsl) *SearchDsl {
	if len(aggs) < 1 {
		return s
	}
	if len(s.AggregatesVal) == 0 {
		s.AggregatesVal = make(map[string]*AggregateDsl)
	}

	for _, agg := range aggs {
		s.AggregatesVal[agg.Name] = agg
	}
	return s
}

func (s *SearchDsl) Query(q *QueryDsl) *SearchDsl {
	s.QueryVal = q
	return s
}

// Filter adds a Filter Clause with optional Boolean Clause.  This accepts n number of
// filter clauses.  If more than one, and missing Boolean Clause it assumes "and"
//
//     qry := Search("github").Filter(
//         Filter().Exists("repository.name"),
//     )
//
//     qry := Search("github").Filter(
//         "or",
//         Filter().Exists("repository.name"),
//         Filter().Terms("actor_attributes.location", "portland"),
//     )
//
//     qry := Search("github").Filter(
//         Filter().Exists("repository.name"),
//         Filter().Terms("repository.has_wiki", true)
//     )
func (s *SearchDsl) Filter(fl ...interface{}) *SearchDsl {
	if s.FilterVal == nil {
		s.FilterVal = NewFilterWrap()
	}

	s.FilterVal.addFilters(fl)
	return s
}

func (s *SearchDsl) Sort(sort ...*SortDsl) *SearchDsl {
	if s.SortBody == nil {
		s.SortBody = make([]*SortDsl, 0)
	}
	s.SortBody = append(s.SortBody, sort...)
	return s
}

func (s *SearchDsl) Scroll(duration string) *SearchDsl {
	s.args["scroll"] = duration
	return s
}

func (s *SearchDsl) SearchType(searchType string) *SearchDsl {
	s.args["search_type"] = searchType
	return s
}
