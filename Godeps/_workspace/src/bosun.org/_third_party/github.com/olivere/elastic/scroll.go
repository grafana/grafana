// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// ScrollService manages a cursor through documents in Elasticsearch.
type ScrollService struct {
	client    *Client
	indices   []string
	types     []string
	keepAlive string
	query     Query
	size      *int
	pretty    bool
	scrollId  string
}

func NewScrollService(client *Client) *ScrollService {
	builder := &ScrollService{
		client: client,
		query:  NewMatchAllQuery(),
	}
	return builder
}

func (s *ScrollService) Index(index string) *ScrollService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, index)
	return s
}

func (s *ScrollService) Indices(indices ...string) *ScrollService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

func (s *ScrollService) Type(typ string) *ScrollService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, typ)
	return s
}

func (s *ScrollService) Types(types ...string) *ScrollService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, types...)
	return s
}

// Scroll is an alias for KeepAlive, the time to keep
// the cursor alive (e.g. "5m" for 5 minutes).
func (s *ScrollService) Scroll(keepAlive string) *ScrollService {
	s.keepAlive = keepAlive
	return s
}

// KeepAlive sets the maximum time the cursor will be
// available before expiration (e.g. "5m" for 5 minutes).
func (s *ScrollService) KeepAlive(keepAlive string) *ScrollService {
	s.keepAlive = keepAlive
	return s
}

func (s *ScrollService) Query(query Query) *ScrollService {
	s.query = query
	return s
}

func (s *ScrollService) Pretty(pretty bool) *ScrollService {
	s.pretty = pretty
	return s
}

func (s *ScrollService) Size(size int) *ScrollService {
	s.size = &size
	return s
}

func (s *ScrollService) ScrollId(scrollId string) *ScrollService {
	s.scrollId = scrollId
	return s
}

func (s *ScrollService) Do() (*SearchResult, error) {
	if s.scrollId == "" {
		return s.GetFirstPage()
	}
	return s.GetNextPage()
}

func (s *ScrollService) GetFirstPage() (*SearchResult, error) {
	// Build url
	path := "/"

	// Indices part
	indexPart := make([]string, 0)
	for _, index := range s.indices {
		index, err := uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	if len(indexPart) > 0 {
		path += strings.Join(indexPart, ",")
	}

	// Types
	typesPart := make([]string, 0)
	for _, typ := range s.types {
		typ, err := uritemplates.Expand("{type}", map[string]string{
			"type": typ,
		})
		if err != nil {
			return nil, err
		}
		typesPart = append(typesPart, typ)
	}
	if len(typesPart) > 0 {
		path += "/" + strings.Join(typesPart, ",")
	}

	// Search
	path += "/_search"

	// Parameters
	params := make(url.Values)
	params.Set("search_type", "scan")
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.keepAlive != "" {
		params.Set("scroll", s.keepAlive)
	} else {
		params.Set("scroll", defaultKeepAlive)
	}
	if s.size != nil && *s.size > 0 {
		params.Set("size", fmt.Sprintf("%d", *s.size))
	}

	// Set body
	body := make(map[string]interface{})
	if s.query != nil {
		body["query"] = s.query.Source()
	}

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	searchResult := new(SearchResult)
	if err := json.Unmarshal(res.Body, searchResult); err != nil {
		return nil, err
	}

	return searchResult, nil
}

func (s *ScrollService) GetNextPage() (*SearchResult, error) {
	if s.scrollId == "" {
		return nil, EOS
	}

	// Build url
	path := "/_search/scroll"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.keepAlive != "" {
		params.Set("scroll", s.keepAlive)
	} else {
		params.Set("scroll", defaultKeepAlive)
	}

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, s.scrollId)
	if err != nil {
		return nil, err
	}

	// Return result
	searchResult := new(SearchResult)
	if err := json.Unmarshal(res.Body, searchResult); err != nil {
		return nil, err
	}

	// Determine last page
	if searchResult == nil || searchResult.Hits == nil || len(searchResult.Hits.Hits) == 0 || searchResult.Hits.TotalHits == 0 {
		return nil, EOS
	}

	return searchResult, nil
}
