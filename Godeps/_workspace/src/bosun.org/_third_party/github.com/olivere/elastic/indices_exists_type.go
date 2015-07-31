// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// IndicesExistsTypeService checks if one or more types exist in one or more indices.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-types-exists.html.
type IndicesExistsTypeService struct {
	client            *Client
	pretty            bool
	index             []string
	typ               []string
	allowNoIndices    *bool
	expandWildcards   string
	local             *bool
	ignoreUnavailable *bool
}

// NewIndicesExistsTypeService creates a new IndicesExistsTypeService.
func NewIndicesExistsTypeService(client *Client) *IndicesExistsTypeService {
	return &IndicesExistsTypeService{
		client: client,
		index:  make([]string, 0),
		typ:    make([]string, 0),
	}
}

// Index is a list of index names; use `_all` to check the types across all indices.
func (s *IndicesExistsTypeService) Index(index ...string) *IndicesExistsTypeService {
	s.index = append(s.index, index...)
	return s
}

// Type is a list of document types to check.
func (s *IndicesExistsTypeService) Type(typ ...string) *IndicesExistsTypeService {
	s.typ = append(s.typ, typ...)
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *IndicesExistsTypeService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesExistsTypeService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *IndicesExistsTypeService) AllowNoIndices(allowNoIndices bool) *IndicesExistsTypeService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *IndicesExistsTypeService) ExpandWildcards(expandWildcards string) *IndicesExistsTypeService {
	s.expandWildcards = expandWildcards
	return s
}

// Local specifies whether to return local information, i.e. do not retrieve
// the state from master node (default: false).
func (s *IndicesExistsTypeService) Local(local bool) *IndicesExistsTypeService {
	s.local = &local
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesExistsTypeService) Pretty(pretty bool) *IndicesExistsTypeService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesExistsTypeService) buildURL() (string, url.Values, error) {
	if err := s.Validate(); err != nil {
		return "", url.Values{}, err
	}

	// Build URL
	path, err := uritemplates.Expand("/{index}/{type}", map[string]string{
		"type":  strings.Join(s.typ, ","),
		"index": strings.Join(s.index, ","),
	})
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
func (s *IndicesExistsTypeService) Validate() error {
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
func (s *IndicesExistsTypeService) Do() (bool, error) {
	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return false, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest("HEAD", path, params, nil)
	if err != nil {
		return false, err
	}

	// Return operation response
	if res.StatusCode == 200 {
		return true, nil
	} else if res.StatusCode == 404 {
		return false, nil
	}
	return false, fmt.Errorf("elastic: got HTTP code %d when it should have been either 200 or 404", res.StatusCode)
}
