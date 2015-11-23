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

// IndicesDeleteTemplateService deletes index templates.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/1.4/indices-templates.html.
type IndicesDeleteTemplateService struct {
	client        *Client
	pretty        bool
	name          string
	timeout       string
	masterTimeout string
}

// NewIndicesDeleteTemplateService creates a new IndicesDeleteTemplateService.
func NewIndicesDeleteTemplateService(client *Client) *IndicesDeleteTemplateService {
	return &IndicesDeleteTemplateService{
		client: client,
	}
}

// Name is the name of the template.
func (s *IndicesDeleteTemplateService) Name(name string) *IndicesDeleteTemplateService {
	s.name = name
	return s
}

// Timeout is an explicit operation timeout.
func (s *IndicesDeleteTemplateService) Timeout(timeout string) *IndicesDeleteTemplateService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *IndicesDeleteTemplateService) MasterTimeout(masterTimeout string) *IndicesDeleteTemplateService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesDeleteTemplateService) Pretty(pretty bool) *IndicesDeleteTemplateService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesDeleteTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_template/{name}", map[string]string{
		"name": s.name,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.timeout != "" {
		params.Set("timeout", s.timeout)
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesDeleteTemplateService) Validate() error {
	var invalid []string
	if s.name == "" {
		invalid = append(invalid, "Name")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *IndicesDeleteTemplateService) Do() (*IndicesDeleteTemplateResponse, error) {
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
	res, err := s.client.PerformRequest("DELETE", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesDeleteTemplateResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesDeleteTemplateResponse is the response of IndicesDeleteTemplateService.Do.
type IndicesDeleteTemplateResponse struct {
	Acknowledged bool `json:"acknowledged,omitempty"`
}
