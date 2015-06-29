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

// GetTemplateService reads a search template.
// It is documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/search-template.html.
type GetTemplateService struct {
	client      *Client
	pretty      bool
	id          string
	version     interface{}
	versionType string
}

// NewGetTemplateService creates a new GetTemplateService.
func NewGetTemplateService(client *Client) *GetTemplateService {
	return &GetTemplateService{
		client: client,
	}
}

// Id is the template ID.
func (s *GetTemplateService) Id(id string) *GetTemplateService {
	s.id = id
	return s
}

// Version is an explicit version number for concurrency control.
func (s *GetTemplateService) Version(version interface{}) *GetTemplateService {
	s.version = version
	return s
}

// VersionType is a specific version type.
func (s *GetTemplateService) VersionType(versionType string) *GetTemplateService {
	s.versionType = versionType
	return s
}

// buildURL builds the URL for the operation.
func (s *GetTemplateService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_search/template/{id}", map[string]string{
		"id": s.id,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *GetTemplateService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation and returns the template.
func (s *GetTemplateService) Do() (*GetTemplateResponse, error) {
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

	// Return result
	ret := new(GetTemplateResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

type GetTemplateResponse struct {
	Template string `json:"template"`
}
