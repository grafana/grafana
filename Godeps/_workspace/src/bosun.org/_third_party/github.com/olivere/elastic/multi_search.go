// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// MultiSearch executes one or more searches in one roundtrip.
// See http://www.elasticsearch.org/guide/reference/api/multi-search/
type MultiSearchService struct {
	client     *Client
	requests   []*SearchRequest
	indices    []string
	pretty     bool
	routing    string
	preference string
}

func NewMultiSearchService(client *Client) *MultiSearchService {
	builder := &MultiSearchService{
		client:   client,
		requests: make([]*SearchRequest, 0),
		indices:  make([]string, 0),
	}
	return builder
}

func (s *MultiSearchService) Add(requests ...*SearchRequest) *MultiSearchService {
	s.requests = append(s.requests, requests...)
	return s
}

func (s *MultiSearchService) Index(index string) *MultiSearchService {
	s.indices = append(s.indices, index)
	return s
}

func (s *MultiSearchService) Indices(indices ...string) *MultiSearchService {
	s.indices = append(s.indices, indices...)
	return s
}

func (s *MultiSearchService) Pretty(pretty bool) *MultiSearchService {
	s.pretty = pretty
	return s
}

func (s *MultiSearchService) Do() (*MultiSearchResult, error) {
	// Build url
	path := "/_msearch"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}

	// Set body
	lines := make([]string, 0)
	for _, sr := range s.requests {
		// Set default indices if not specified in the request
		if !sr.HasIndices() && len(s.indices) > 0 {
			sr = sr.Indices(s.indices...)
		}

		header, err := json.Marshal(sr.header())
		if err != nil {
			return nil, err
		}
		body, err := json.Marshal(sr.body())
		if err != nil {
			return nil, err
		}
		lines = append(lines, string(header))
		lines = append(lines, string(body))
	}
	body := strings.Join(lines, "\n") + "\n" // Don't forget trailing \n

	// Get response
	res, err := s.client.PerformRequest("GET", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(MultiSearchResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

type MultiSearchResult struct {
	Responses []*SearchResult `json:"responses,omitempty"`
}
