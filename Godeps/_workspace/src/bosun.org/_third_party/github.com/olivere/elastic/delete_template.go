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

// DeleteTemplateService deletes a search template. More information can
// be found at http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/search-template.html.
type DeleteTemplateService struct {
	client      *Client
	pretty      bool
	id          string
	version     *int
	versionType string
}

// NewDeleteTemplateService creates a new DeleteTemplateService.
func NewDeleteTemplateService(client *Client) *DeleteTemplateService {
	return &DeleteTemplateService{
		client: client,
	}
}

// Id is the template ID.
func (s *DeleteTemplateService) Id(id string) *DeleteTemplateService {
	s.id = id
	return s
}

// Version an explicit version number for concurrency control.
func (s *DeleteTemplateService) Version(version int) *DeleteTemplateService {
	s.version = &version
	return s
}

// VersionType specifies a version type.
func (s *DeleteTemplateService) VersionType(versionType string) *DeleteTemplateService {
	s.versionType = versionType
	return s
}

// buildURL builds the URL for the operation.
func (s *DeleteTemplateService) buildURL() (string, url.Values, error) {
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
		params.Set("version", fmt.Sprintf("%d", *s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}

	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *DeleteTemplateService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *DeleteTemplateService) Do() (*DeleteTemplateResponse, error) {
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
	ret := new(DeleteTemplateResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// DeleteTemplateResponse is the response of DeleteTemplateService.Do.
type DeleteTemplateResponse struct {
	Found   bool   `json:"found"`
	Index   string `json:"_index"`
	Type    string `json:"_type"`
	Id      string `json:"_id"`
	Version int    `json:"_version"`
}
