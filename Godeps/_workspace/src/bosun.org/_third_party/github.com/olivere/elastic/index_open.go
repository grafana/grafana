// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// OpenIndexService opens an index.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/indices-open-close.html.
type OpenIndexService struct {
	client            *Client
	pretty            bool
	index             string
	expandWildcards   string
	timeout           string
	masterTimeout     string
	ignoreUnavailable *bool
	allowNoIndices    *bool
}

// NewOpenIndexService creates a new OpenIndexService.
func NewOpenIndexService(client *Client) *OpenIndexService {
	return &OpenIndexService{client: client}
}

// Index is the name of the index to open.
func (s *OpenIndexService) Index(index string) *OpenIndexService {
	s.index = index
	return s
}

// Timeout is an explicit operation timeout.
func (s *OpenIndexService) Timeout(timeout string) *OpenIndexService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *OpenIndexService) MasterTimeout(masterTimeout string) *OpenIndexService {
	s.masterTimeout = masterTimeout
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should
// be ignored when unavailable (missing or closed).
func (s *OpenIndexService) IgnoreUnavailable(ignoreUnavailable bool) *OpenIndexService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *OpenIndexService) AllowNoIndices(allowNoIndices bool) *OpenIndexService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both..
func (s *OpenIndexService) ExpandWildcards(expandWildcards string) *OpenIndexService {
	s.expandWildcards = expandWildcards
	return s
}

// buildURL builds the URL for the operation.
func (s *OpenIndexService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/_open", map[string]string{
		"index": s.index,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *OpenIndexService) Validate() error {
	var invalid []string
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *OpenIndexService) Do() (*OpenIndexResponse, error) {
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
	res, err := s.client.PerformRequest("POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(OpenIndexResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// OpenIndexResponse is the response of OpenIndexService.Do.
type OpenIndexResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
