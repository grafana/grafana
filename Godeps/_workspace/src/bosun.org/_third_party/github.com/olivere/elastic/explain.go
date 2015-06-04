// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

var (
	_ = fmt.Print
	_ = log.Print
	_ = strings.Index
	_ = uritemplates.Expand
	_ = url.Parse
)

// ExplainService computes a score explanation for a query and
// a specific document.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-explain.html.
type ExplainService struct {
	client                 *Client
	pretty                 bool
	id                     string
	index                  string
	typ                    string
	q                      string
	routing                string
	lenient                *bool
	analyzer               string
	df                     string
	fields                 []string
	lowercaseExpandedTerms *bool
	xSourceInclude         []string
	analyzeWildcard        *bool
	parent                 string
	preference             string
	xSource                []string
	defaultOperator        string
	xSourceExclude         []string
	source                 string
	bodyJson               interface{}
	bodyString             string
}

// NewExplainService creates a new ExplainService.
func NewExplainService(client *Client) *ExplainService {
	return &ExplainService{
		client:         client,
		xSource:        make([]string, 0),
		xSourceExclude: make([]string, 0),
		fields:         make([]string, 0),
		xSourceInclude: make([]string, 0),
	}
}

// Id is the document ID.
func (s *ExplainService) Id(id string) *ExplainService {
	s.id = id
	return s
}

// Index is the name of the index.
func (s *ExplainService) Index(index string) *ExplainService {
	s.index = index
	return s
}

// Type is the type of the document.
func (s *ExplainService) Type(typ string) *ExplainService {
	s.typ = typ
	return s
}

// Source is the URL-encoded query definition (instead of using the request body).
func (s *ExplainService) Source(source string) *ExplainService {
	s.source = source
	return s
}

// XSourceExclude is a list of fields to exclude from the returned _source field.
func (s *ExplainService) XSourceExclude(xSourceExclude ...string) *ExplainService {
	s.xSourceExclude = make([]string, 0)
	s.xSourceExclude = append(s.xSourceExclude, xSourceExclude...)
	return s
}

// Lenient specifies whether format-based query failures
// (such as providing text to a numeric field) should be ignored.
func (s *ExplainService) Lenient(lenient bool) *ExplainService {
	s.lenient = &lenient
	return s
}

// Query in the Lucene query string syntax.
func (s *ExplainService) Q(q string) *ExplainService {
	s.q = q
	return s
}

// Routing sets a specific routing value.
func (s *ExplainService) Routing(routing string) *ExplainService {
	s.routing = routing
	return s
}

// AnalyzeWildcard specifies whether wildcards and prefix queries
// in the query string query should be analyzed (default: false).
func (s *ExplainService) AnalyzeWildcard(analyzeWildcard bool) *ExplainService {
	s.analyzeWildcard = &analyzeWildcard
	return s
}

// Analyzer is the analyzer for the query string query.
func (s *ExplainService) Analyzer(analyzer string) *ExplainService {
	s.analyzer = analyzer
	return s
}

// Df is the default field for query string query (default: _all).
func (s *ExplainService) Df(df string) *ExplainService {
	s.df = df
	return s
}

// Fields is a list of fields to return in the response.
func (s *ExplainService) Fields(fields ...string) *ExplainService {
	s.fields = make([]string, 0)
	s.fields = append(s.fields, fields...)
	return s
}

// LowercaseExpandedTerms specifies whether query terms should be lowercased.
func (s *ExplainService) LowercaseExpandedTerms(lowercaseExpandedTerms bool) *ExplainService {
	s.lowercaseExpandedTerms = &lowercaseExpandedTerms
	return s
}

// XSourceInclude is a list of fields to extract and return from the _source field.
func (s *ExplainService) XSourceInclude(xSourceInclude ...string) *ExplainService {
	s.xSourceInclude = make([]string, 0)
	s.xSourceInclude = append(s.xSourceInclude, xSourceInclude...)
	return s
}

// DefaultOperator is the default operator for query string query (AND or OR).
func (s *ExplainService) DefaultOperator(defaultOperator string) *ExplainService {
	s.defaultOperator = defaultOperator
	return s
}

// Parent is the ID of the parent document.
func (s *ExplainService) Parent(parent string) *ExplainService {
	s.parent = parent
	return s
}

// Preference specifies the node or shard the operation should be performed on (default: random).
func (s *ExplainService) Preference(preference string) *ExplainService {
	s.preference = preference
	return s
}

// XSource is true or false to return the _source field or not, or a list of fields to return.
func (s *ExplainService) XSource(xSource ...string) *ExplainService {
	s.xSource = make([]string, 0)
	s.xSource = append(s.xSource, xSource...)
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *ExplainService) Pretty(pretty bool) *ExplainService {
	s.pretty = pretty
	return s
}

// Query sets a query definition using the Query DSL.
func (s *ExplainService) Query(query Query) *ExplainService {
	body := make(map[string]interface{})
	body["query"] = query.Source()
	s.bodyJson = body
	return s
}

// BodyJson sets the query definition using the Query DSL.
func (s *ExplainService) BodyJson(body interface{}) *ExplainService {
	s.bodyJson = body
	return s
}

// BodyString sets the query definition using the Query DSL as a string.
func (s *ExplainService) BodyString(body string) *ExplainService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *ExplainService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/{type}/{id}/_explain", map[string]string{
		"id":    s.id,
		"index": s.index,
		"type":  s.typ,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if len(s.xSource) > 0 {
		params.Set("_source", strings.Join(s.xSource, ","))
	}
	if s.defaultOperator != "" {
		params.Set("default_operator", s.defaultOperator)
	}
	if s.parent != "" {
		params.Set("parent", s.parent)
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.source != "" {
		params.Set("source", s.source)
	}
	if len(s.xSourceExclude) > 0 {
		params.Set("_source_exclude", strings.Join(s.xSourceExclude, ","))
	}
	if s.lenient != nil {
		params.Set("lenient", fmt.Sprintf("%v", *s.lenient))
	}
	if s.q != "" {
		params.Set("q", s.q)
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if s.lowercaseExpandedTerms != nil {
		params.Set("lowercase_expanded_terms", fmt.Sprintf("%v", *s.lowercaseExpandedTerms))
	}
	if len(s.xSourceInclude) > 0 {
		params.Set("_source_include", strings.Join(s.xSourceInclude, ","))
	}
	if s.analyzeWildcard != nil {
		params.Set("analyze_wildcard", fmt.Sprintf("%v", *s.analyzeWildcard))
	}
	if s.analyzer != "" {
		params.Set("analyzer", s.analyzer)
	}
	if s.df != "" {
		params.Set("df", s.df)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *ExplainService) Validate() error {
	var invalid []string
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if s.typ == "" {
		invalid = append(invalid, "Type")
	}
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *ExplainService) Do() (*ExplainResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Setup HTTP request body
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else {
		body = s.bodyString
	}

	// Get HTTP response
	res, err := s.client.PerformRequest("GET", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(ExplainResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ExplainResponse is the response of ExplainService.Do.
type ExplainResponse struct {
	Index       string                 `json:"_index"`
	Type        string                 `json:"_type"`
	Id          string                 `json:"_id"`
	Matched     bool                   `json:"matched"`
	Explanation map[string]interface{} `json:"explanation"`
}
