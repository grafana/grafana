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

// DeleteMappingService allows to delete a mapping along with its data.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-delete-mapping.html.
type DeleteMappingService struct {
	client        *Client
	pretty        bool
	index         []string
	typ           []string
	masterTimeout string
}

// NewDeleteMappingService creates a new DeleteMappingService.
func NewDeleteMappingService(client *Client) *DeleteMappingService {
	return &DeleteMappingService{
		client: client,
		index:  make([]string, 0),
		typ:    make([]string, 0),
	}
}

// Index is a list of index names (supports wildcards). Use `_all` for all indices.
func (s *DeleteMappingService) Index(index ...string) *DeleteMappingService {
	s.index = append(s.index, index...)
	return s
}

// Type is a list of document types to delete (supports wildcards).
// Use `_all` to delete all document types in the specified indices..
func (s *DeleteMappingService) Type(typ ...string) *DeleteMappingService {
	s.typ = append(s.typ, typ...)
	return s
}

// MasterTimeout specifies the timeout for connecting to master.
func (s *DeleteMappingService) MasterTimeout(masterTimeout string) *DeleteMappingService {
	s.masterTimeout = masterTimeout
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *DeleteMappingService) Pretty(pretty bool) *DeleteMappingService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *DeleteMappingService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/_mapping/{type}", map[string]string{
		"index": strings.Join(s.index, ","),
		"type":  strings.Join(s.typ, ","),
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.masterTimeout != "" {
		params.Set("master_timeout", s.masterTimeout)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *DeleteMappingService) Validate() error {
	var invalid []string
	if len(s.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(s.typ) == 0 {
		invalid = append(invalid, "Type")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *DeleteMappingService) Do() (*DeleteMappingResponse, error) {
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
	ret := new(DeleteMappingResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// DeleteMappingResponse is the response of DeleteMappingService.Do.
type DeleteMappingResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
