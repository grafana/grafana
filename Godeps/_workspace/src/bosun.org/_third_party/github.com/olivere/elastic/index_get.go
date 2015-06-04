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

// IndicesGetService retrieves information about one or more indices.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-get-index.html.
type IndicesGetService struct {
	client            *Client
	pretty            bool
	index             []string
	feature           []string
	expandWildcards   string
	local             *bool
	ignoreUnavailable *bool
	allowNoIndices    *bool
}

// NewIndicesGetService creates a new IndicesGetService.
func NewIndicesGetService(client *Client) *IndicesGetService {
	return &IndicesGetService{
		client:  client,
		index:   make([]string, 0),
		feature: make([]string, 0),
	}
}

// Index is a list of index names. Use _all to retrieve information about
// all indices of a cluster.
func (s *IndicesGetService) Index(index ...string) *IndicesGetService {
	s.index = append(s.index, index...)
	return s
}

// Feature is a list of features (e.g. _settings,_mappings,_warmers, and _aliases).
func (s *IndicesGetService) Feature(feature ...string) *IndicesGetService {
	s.feature = append(s.feature, feature...)
	return s
}

// ExpandWildcards indicates whether wildcard expressions should
// get expanded to open or closed indices (default: open).
func (s *IndicesGetService) ExpandWildcards(expandWildcards string) *IndicesGetService {
	s.expandWildcards = expandWildcards
	return s
}

// Local indicates whether to return local information (do not retrieve
// the state from master node (default: false)).
func (s *IndicesGetService) Local(local bool) *IndicesGetService {
	s.local = &local
	return s
}

// IgnoreUnavailable indicates whether to ignore unavailable indexes (default: false).
func (s *IndicesGetService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesGetService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard expression
// resolves to no concrete indices (default: false).
func (s *IndicesGetService) AllowNoIndices(allowNoIndices bool) *IndicesGetService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesGetService) Pretty(pretty bool) *IndicesGetService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesGetService) buildURL() (string, url.Values, error) {
	var err error
	var path string
	var index []string

	if len(s.index) > 0 {
		index = s.index
	} else {
		index = []string{"_all"}
	}

	if len(s.feature) > 0 {
		// Build URL
		path, err = uritemplates.Expand("/{index}/{feature}", map[string]string{
			"index":   strings.Join(index, ","),
			"feature": strings.Join(s.feature, ","),
		})
	} else {
		// Build URL
		path, err = uritemplates.Expand("/{index}", map[string]string{
			"index": strings.Join(index, ","),
		})
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesGetService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesGetService) Do() (map[string]*IndicesGetResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest("GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	var ret map[string]*IndicesGetResponse
	if err := json.Unmarshal(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesGetResponse is part of the response of IndicesGetService.Do.
type IndicesGetResponse struct {
	Aliases  map[string]interface{} `json:"aliases"`
	Mappings map[string]interface{} `json:"mappings"`
	Settings map[string]interface{} `json:"settings"`
	Warmers  map[string]interface{} `json:"warmers"`
}
