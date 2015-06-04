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

// ClearScrollService is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/search-request-scroll.html.
type ClearScrollService struct {
	client     *Client
	pretty     bool
	scrollId   []string
	bodyJson   interface{}
	bodyString string
}

// NewClearScrollService creates a new ClearScrollService.
func NewClearScrollService(client *Client) *ClearScrollService {
	return &ClearScrollService{
		client:   client,
		scrollId: make([]string, 0),
	}
}

// ScrollId is a list of scroll IDs to clear.
// Use _all to clear all search contexts.
func (s *ClearScrollService) ScrollId(scrollId ...string) *ClearScrollService {
	s.scrollId = make([]string, 0)
	s.scrollId = append(s.scrollId, scrollId...)
	return s
}

// buildURL builds the URL for the operation.
func (s *ClearScrollService) buildURL() (string, url.Values, error) {
	path, err := uritemplates.Expand("/_search/scroll", map[string]string{})
	if err != nil {
		return "", url.Values{}, err
	}
	return path, url.Values{}, nil
}

// Validate checks if the operation is valid.
func (s *ClearScrollService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *ClearScrollService) Do() (*ClearScrollResponse, error) {
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
	body := strings.Join(s.scrollId, ",")

	// Get HTTP response
	res, err := s.client.PerformRequest("DELETE", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(ClearScrollResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// ClearScrollResponse is the response of ClearScrollService.Do.
type ClearScrollResponse struct {
}
