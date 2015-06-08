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

// CountService is a convenient service for determining the
// number of documents in an index. Use SearchService with
// a SearchType of count for counting with queries etc.
type CountService struct {
	client  *Client
	indices []string
	types   []string
	query   Query
	pretty  bool
}

// CountResult is the result returned from using the Count API
// (http://www.elasticsearch.org/guide/reference/api/count/)
type CountResult struct {
	Count  int64      `json:"count"`
	Shards shardsInfo `json:"_shards,omitempty"`
}

func NewCountService(client *Client) *CountService {
	builder := &CountService{
		client: client,
	}
	return builder
}

func (s *CountService) Index(index string) *CountService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, index)
	return s
}

func (s *CountService) Indices(indices ...string) *CountService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

func (s *CountService) Type(typ string) *CountService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, typ)
	return s
}

func (s *CountService) Types(types ...string) *CountService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, types...)
	return s
}

func (s *CountService) Query(query Query) *CountService {
	s.query = query
	return s
}

func (s *CountService) Pretty(pretty bool) *CountService {
	s.pretty = pretty
	return s
}

func (s *CountService) Do() (int64, error) {
	var err error

	// Build url
	path := "/"

	// Indices part
	indexPart := make([]string, 0)
	for _, index := range s.indices {
		index, err = uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return 0, err
		}
		indexPart = append(indexPart, index)
	}
	if len(indexPart) > 0 {
		path += strings.Join(indexPart, ",")
	}

	// Types part
	typesPart := make([]string, 0)
	for _, typ := range s.types {
		typ, err = uritemplates.Expand("{type}", map[string]string{
			"type": typ,
		})
		if err != nil {
			return 0, err
		}
		typesPart = append(typesPart, typ)
	}
	if len(typesPart) > 0 {
		path += "/" + strings.Join(typesPart, ",")
	}

	// Search
	path += "/_count"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}

	// Set body if there is a query specified
	var body interface{}
	if s.query != nil {
		query := make(map[string]interface{})
		query["query"] = s.query.Source()
		body = query
	}

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return 0, err
	}

	// Return result
	ret := new(CountResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return 0, err
	}
	if ret != nil {
		return ret.Count, nil
	}

	return int64(0), nil
}
