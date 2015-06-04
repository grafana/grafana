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

// PutMappingService allows to register specific mapping definition
// for a specific type.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-put-mapping.html.
type PutMappingService struct {
	client            *Client
	pretty            bool
	typ               string
	index             []string
	masterTimeout     string
	ignoreUnavailable *bool
	allowNoIndices    *bool
	expandWildcards   string
	ignoreConflicts   *bool
	timeout           string
	bodyJson          map[string]interface{}
	bodyString        string
}

// NewPutMappingService creates a new PutMappingService.
func NewPutMappingService(client *Client) *PutMappingService {
	return &PutMappingService{
		client: client,
		index:  make([]string, 0),
	}
}

// Index is a list of index names the mapping should be added to
// (supports wildcards); use `_all` or omit to add the mapping on all indices.
func (s *PutMappingService) Index(index ...string) *PutMappingService {
	s.index = append(s.index, index...)
	return s
}

// Type is the name of the document type.
func (s *PutMappingService) Type(typ string) *PutMappingService {
	s.typ = typ
	return s
}

// Timeout is an explicit operation timeout.
func (s *PutMappingService) Timeout(timeout string) *PutMappingService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *PutMappingService) MasterTimeout(masterTimeout string) *PutMappingService {
	s.masterTimeout = masterTimeout
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *PutMappingService) IgnoreUnavailable(ignoreUnavailable bool) *PutMappingService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// This includes `_all` string or when no indices have been specified.
func (s *PutMappingService) AllowNoIndices(allowNoIndices bool) *PutMappingService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *PutMappingService) ExpandWildcards(expandWildcards string) *PutMappingService {
	s.expandWildcards = expandWildcards
	return s
}

// IgnoreConflicts specifies whether to ignore conflicts while updating
// the mapping (default: false).
func (s *PutMappingService) IgnoreConflicts(ignoreConflicts bool) *PutMappingService {
	s.ignoreConflicts = &ignoreConflicts
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *PutMappingService) Pretty(pretty bool) *PutMappingService {
	s.pretty = pretty
	return s
}

// BodyJson contains the mapping definition.
func (s *PutMappingService) BodyJson(mapping map[string]interface{}) *PutMappingService {
	s.bodyJson = mapping
	return s
}

// BodyString is the mapping definition serialized as a string.
func (s *PutMappingService) BodyString(mapping string) *PutMappingService {
	s.bodyString = mapping
	return s
}

// buildURL builds the URL for the operation.
func (s *PutMappingService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	// Build URL: Typ MUST be specified and is verified in Validate.
	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_mapping/{type}", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  s.typ,
		})
	} else {
		path, err = uritemplates.Expand("/_mapping/{type}", map[string]string{
			"type": s.typ,
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
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.ignoreConflicts != nil {
		params.Set("ignore_conflicts", fmt.Sprintf("%v", *s.ignoreConflicts))
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
func (s *PutMappingService) Validate() error {
	var invalid []string
	if s.typ == "" {
		invalid = append(invalid, "Type")
	}
	if s.bodyString == "" && s.bodyJson == nil {
		invalid = append(invalid, "BodyJson")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *PutMappingService) Do() (*PutMappingResponse, error) {
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
	res, err := s.client.PerformRequest("PUT", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(PutMappingResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// PutMappingResponse is the response of PutMappingService.Do.
type PutMappingResponse struct {
	Acknowledged bool `json:"acknowledged"`
}
