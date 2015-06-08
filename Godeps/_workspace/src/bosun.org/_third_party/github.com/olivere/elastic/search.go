// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// Search for documents in Elasticsearch.
type SearchService struct {
	client       *Client
	searchSource *SearchSource
	source       interface{}
	pretty       bool
	searchType   string
	indices      []string
	queryHint    string
	routing      string
	preference   string
	types        []string
}

// NewSearchService creates a new service for searching in Elasticsearch.
// You typically do not create the service yourself manually, but access
// it via client.Search().
func NewSearchService(client *Client) *SearchService {
	builder := &SearchService{
		client:       client,
		searchSource: NewSearchSource(),
	}
	return builder
}

// SearchSource sets the search source builder to use with this service.
func (s *SearchService) SearchSource(searchSource *SearchSource) *SearchService {
	s.searchSource = searchSource
	if s.searchSource == nil {
		s.searchSource = NewSearchSource()
	}
	return s
}

// Source allows the user to set the request body manually without using
// any of the structs and interfaces in Elastic.
func (s *SearchService) Source(source interface{}) *SearchService {
	s.source = source
	return s
}

// Index sets the name of the index to use for search.
func (s *SearchService) Index(index string) *SearchService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, index)
	return s
}

// Indices sets the names of the indices to use for search.
func (s *SearchService) Indices(indices ...string) *SearchService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

// Type restricts the search for the given type.
func (s *SearchService) Type(typ string) *SearchService {
	if s.types == nil {
		s.types = []string{typ}
	} else {
		s.types = append(s.types, typ)
	}
	return s
}

// Types allows to restrict the search to a list of types.
func (s *SearchService) Types(types ...string) *SearchService {
	if s.types == nil {
		s.types = make([]string, len(types))
	}
	s.types = append(s.types, types...)
	return s
}

// Pretty enables the caller to indent the JSON output.
func (s *SearchService) Pretty(pretty bool) *SearchService {
	s.pretty = pretty
	return s
}

// Timeout sets the timeout to use, e.g. "1s" or "1000ms".
func (s *SearchService) Timeout(timeout string) *SearchService {
	s.searchSource = s.searchSource.Timeout(timeout)
	return s
}

// TimeoutInMillis sets the timeout in milliseconds.
func (s *SearchService) TimeoutInMillis(timeoutInMillis int) *SearchService {
	s.searchSource = s.searchSource.TimeoutInMillis(timeoutInMillis)
	return s
}

// SearchType sets the search operation type. Valid values are:
// "query_then_fetch", "query_and_fetch", "dfs_query_then_fetch",
// "dfs_query_and_fetch", "count", "scan".
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-search-type.html#search-request-search-type
// for details.
func (s *SearchService) SearchType(searchType string) *SearchService {
	s.searchType = searchType
	return s
}

// Routing allows for (a comma-separated) list of specific routing values.
func (s *SearchService) Routing(routing string) *SearchService {
	s.routing = routing
	return s
}

// Preference specifies the node or shard the operation should be
// performed on (default: "random").
func (s *SearchService) Preference(preference string) *SearchService {
	s.preference = preference
	return s
}

func (s *SearchService) QueryHint(queryHint string) *SearchService {
	s.queryHint = queryHint
	return s
}

// Query sets the query to perform, e.g. MatchAllQuery.
func (s *SearchService) Query(query Query) *SearchService {
	s.searchSource = s.searchSource.Query(query)
	return s
}

// PostFilter is executed as the last filter. It only affects the
// search hits but not facets. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-post-filter.html
// for details.
func (s *SearchService) PostFilter(postFilter Filter) *SearchService {
	s.searchSource = s.searchSource.PostFilter(postFilter)
	return s
}

// Highlight sets the highlighting. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-highlighting.html
// for details.
func (s *SearchService) Highlight(highlight *Highlight) *SearchService {
	s.searchSource = s.searchSource.Highlight(highlight)
	return s
}

// GlobalSuggestText sets the global text for suggesters. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters.html#global-suggest
// for details.
func (s *SearchService) GlobalSuggestText(globalText string) *SearchService {
	s.searchSource = s.searchSource.GlobalSuggestText(globalText)
	return s
}

// Suggester sets the suggester. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters.html
// for details.
func (s *SearchService) Suggester(suggester Suggester) *SearchService {
	s.searchSource = s.searchSource.Suggester(suggester)
	return s
}

// Facet adds a facet to the search. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets.html
// to get an overview of Elasticsearch facets.
func (s *SearchService) Facet(name string, facet Facet) *SearchService {
	s.searchSource = s.searchSource.Facet(name, facet)
	return s
}

// Aggregation adds an aggregation to the search. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations.html
// for an overview of aggregations in Elasticsearch.
func (s *SearchService) Aggregation(name string, aggregation Aggregation) *SearchService {
	s.searchSource = s.searchSource.Aggregation(name, aggregation)
	return s
}

// MinScore excludes documents which have a score less than the minimum
// specified here. See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-min-score.html.
func (s *SearchService) MinScore(minScore float64) *SearchService {
	s.searchSource = s.searchSource.MinScore(minScore)
	return s
}

// From defines the offset from the first result you want to fetch.
// Use it in combination with Size to paginate through results.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-from-size.html
// for details.
func (s *SearchService) From(from int) *SearchService {
	s.searchSource = s.searchSource.From(from)
	return s
}

// Size defines the maximum number of hits to be returned.
// Use it in combination with From to paginate through results.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-from-size.html
// for details.
func (s *SearchService) Size(size int) *SearchService {
	s.searchSource = s.searchSource.Size(size)
	return s
}

// Explain can be enabled to provide an explanation for each hit and how its
// score was computed.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-explain.html
// for details.
func (s *SearchService) Explain(explain bool) *SearchService {
	s.searchSource = s.searchSource.Explain(explain)
	return s
}

// Version can be set to true to return a version for each search hit.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-version.html.
func (s *SearchService) Version(version bool) *SearchService {
	s.searchSource = s.searchSource.Version(version)
	return s
}

// Sort the results by the given field, in the given order.
// Use the alternative SortWithInfo to use a struct to define the sorting.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *SearchService) Sort(field string, ascending bool) *SearchService {
	s.searchSource = s.searchSource.Sort(field, ascending)
	return s
}

// SortWithInfo defines how to sort results.
// Use the Sort func for a shortcut.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *SearchService) SortWithInfo(info SortInfo) *SearchService {
	s.searchSource = s.searchSource.SortWithInfo(info)
	return s
}

// SortBy defines how to sort results.
// Use the Sort func for a shortcut.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *SearchService) SortBy(sorter ...Sorter) *SearchService {
	s.searchSource = s.searchSource.SortBy(sorter...)
	return s
}

// Fields tells Elasticsearch to only load specific fields from a search hit.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-fields.html.
func (s *SearchService) Fields(fields ...string) *SearchService {
	s.searchSource = s.searchSource.Fields(fields...)
	return s
}

// Do executes the search and returns a SearchResult.
func (s *SearchService) Do() (*SearchResult, error) {
	// Build url
	path := "/"

	// Indices part
	indexPart := make([]string, 0)
	for _, index := range s.indices {
		index, err := uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	path += strings.Join(indexPart, ",")

	// Types part
	if len(s.types) > 0 {
		typesPart := make([]string, 0)
		for _, typ := range s.types {
			typ, err := uritemplates.Expand("{type}", map[string]string{
				"type": typ,
			})
			if err != nil {
				return nil, err
			}
			typesPart = append(typesPart, typ)
		}
		path += "/"
		path += strings.Join(typesPart, ",")
	}

	// Search
	path += "/_search"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.searchType != "" {
		params.Set("search_type", s.searchType)
	}

	// Perform request
	var body interface{}
	if s.source != nil {
		body = s.source
	} else {
		body = s.searchSource.Source()
	}
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return search results
	ret := new(SearchResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// SearchResult is the result of a search in Elasticsearch.
type SearchResult struct {
	TookInMillis int64         `json:"took"`            // search time in milliseconds
	ScrollId     string        `json:"_scroll_id"`      // only used with Scroll and Scan operations
	Hits         *SearchHits   `json:"hits"`            // the actual search hits
	Suggest      SearchSuggest `json:"suggest"`         // results from suggesters
	Facets       SearchFacets  `json:"facets"`          // results from facets
	Aggregations Aggregations  `json:"aggregations"`    // results from aggregations
	TimedOut     bool          `json:"timed_out"`       // true if the search timed out
	Error        string        `json:"error,omitempty"` // used in MultiSearch only
}

// SearchHits specifies the list of search hits.
type SearchHits struct {
	TotalHits int64        `json:"total"`     // total number of hits found
	MaxScore  *float64     `json:"max_score"` // maximum score of all hits
	Hits      []*SearchHit `json:"hits"`      // the actual hits returned
}

// SearchHit is a single hit.
type SearchHit struct {
	Score       *float64               `json:"_score"`       // computed score
	Index       string                 `json:"_index"`       // index name
	Id          string                 `json:"_id"`          // external or internal
	Type        string                 `json:"_type"`        // type
	Version     *int64                 `json:"_version"`     // version number, when Version is set to true in SearchService
	Sort        []interface{}          `json:"sort"`         // sort information
	Highlight   SearchHitHighlight     `json:"highlight"`    // highlighter information
	Source      *json.RawMessage       `json:"_source"`      // stored document source
	Fields      map[string]interface{} `json:"fields"`       // returned fields
	Explanation *SearchExplanation     `json:"_explanation"` // explains how the score was computed

	// Shard
	// HighlightFields
	// SortValues
	// MatchedFilters
}

// SearchExplanation explains how the score for a hit was computed.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-explain.html.
type SearchExplanation struct {
	Value       float64             `json:"value"`             // e.g. 1.0
	Description string              `json:"description"`       // e.g. "boost" or "ConstantScore(*:*), product of:"
	Details     []SearchExplanation `json:"details,omitempty"` // recursive details
}

// Suggest

// SearchSuggest is a map of suggestions.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters.html.
type SearchSuggest map[string][]SearchSuggestion

// SearchSuggestion is a single search suggestion.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters.html.
type SearchSuggestion struct {
	Text    string                   `json:"text"`
	Offset  int                      `json:"offset"`
	Length  int                      `json:"length"`
	Options []SearchSuggestionOption `json:"options"`
}

// SearchSuggestionOption is an option of a SearchSuggestion.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters.html.
type SearchSuggestionOption struct {
	Text    string      `json:"text"`
	Score   float32     `json:"score"`
	Freq    int         `json:"freq"`
	Payload interface{} `json:"payload"`
}

// Facets

// SearchFacets is a map of facets.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets.html.
type SearchFacets map[string]*SearchFacet

// SearchFacet is a single facet.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets.html.
type SearchFacet struct {
	Type    string             `json:"_type"`
	Missing int                `json:"missing"`
	Total   int                `json:"total"`
	Other   int                `json:"other"`
	Terms   []searchFacetTerm  `json:"terms"`
	Ranges  []searchFacetRange `json:"ranges"`
	Entries []searchFacetEntry `json:"entries"`
}

// searchFacetTerm is the result of a terms facet.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-terms-facet.html.
type searchFacetTerm struct {
	Term  string `json:"term"`
	Count int    `json:"count"`
}

// searchFacetRange is the result of a range facet.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-range-facet.html.
type searchFacetRange struct {
	From       *float64 `json:"from"`
	FromStr    *string  `json:"from_str"`
	To         *float64 `json:"to"`
	ToStr      *string  `json:"to_str"`
	Count      int      `json:"count"`
	Min        *float64 `json:"min"`
	Max        *float64 `json:"max"`
	TotalCount int      `json:"total_count"`
	Total      *float64 `json:"total"`
	Mean       *float64 `json:"mean"`
}

// searchFacetEntry is a general facet entry.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets.html
type searchFacetEntry struct {
	// Key for this facet, e.g. in histograms
	Key interface{} `json:"key"`
	// Date histograms contain the number of milliseconds as date:
	// If e.Time = 1293840000000, then: Time.at(1293840000000/1000) => 2011-01-01
	Time int64 `json:"time"`
	// Number of hits for this facet
	Count int `json:"count"`
	// Min is either a string like "Infinity" or a float64.
	// This is returned with some DateHistogram facets.
	Min interface{} `json:"min,omitempty"`
	// Max is either a string like "-Infinity" or a float64
	// This is returned with some DateHistogram facets.
	Max interface{} `json:"max,omitempty"`
	// Total is the sum of all entries on the recorded Time
	// This is returned with some DateHistogram facets.
	Total float64 `json:"total,omitempty"`
	// TotalCount is the number of entries for Total
	// This is returned with some DateHistogram facets.
	TotalCount int `json:"total_count,omitempty"`
	// Mean is the mean value
	// This is returned with some DateHistogram facets.
	Mean float64 `json:"mean,omitempty"`
}

// Aggregations (see search_aggs.go)

// Highlighting

// SearchHitHighlight is the highlight information of a search hit.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-highlighting.html
// for a general discussion of highlighting.
type SearchHitHighlight map[string][]string
