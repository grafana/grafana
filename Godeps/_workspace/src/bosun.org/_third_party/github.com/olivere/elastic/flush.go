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

type FlushService struct {
	client *Client

	indices []string
	refresh *bool
	full    *bool
}

func NewFlushService(client *Client) *FlushService {
	builder := &FlushService{
		client: client,
	}
	return builder
}

func (s *FlushService) Index(index string) *FlushService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, index)
	return s
}

func (s *FlushService) Indices(indices ...string) *FlushService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

func (s *FlushService) Refresh(refresh bool) *FlushService {
	s.refresh = &refresh
	return s
}

func (s *FlushService) Full(full bool) *FlushService {
	s.full = &full
	return s
}

func (s *FlushService) Do() (*FlushResult, error) {
	// Build url
	path := "/"

	// Indices part
	if len(s.indices) > 0 {
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
		path += strings.Join(indexPart, ",") + "/"
	}
	path += "_flush"

	// Parameters
	params := make(url.Values)
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.full != nil {
		params.Set("full", fmt.Sprintf("%v", *s.full))
	}

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(FlushResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a flush request.

type shardsInfo struct {
	Total      int `json:"total"`
	Successful int `json:"successful"`
	Failed     int `json:"failed"`
}

type FlushResult struct {
	Shards shardsInfo `json:"_shards"`
}
