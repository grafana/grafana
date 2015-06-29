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

// Flush allows to flush one or more indices. The flush process of an index
// basically frees memory from the index by flushing data to the index
// storage and clearing the internal transaction log.
//
// See http://www.elastic.co/guide/en/elasticsearch/reference/current/indices-flush.html
// for details.
type FlushService struct {
	client *Client

	indices           []string
	force             *bool
	full              *bool
	waitIfOngoing     *bool
	ignoreUnavailable *bool
	allowNoIndices    *bool
	expandWildcards   string
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

// Force specifies whether to force a flush even if it is not necessary.
func (s *FlushService) Force(force bool) *FlushService {
	s.force = &force
	return s
}

// Full, when set to true, creates a new index writer for the index and
// refreshes all settings related to the index.
func (s *FlushService) Full(full bool) *FlushService {
	s.full = &full
	return s
}

// WaitIfOngoing will block until the flush can be executed (if set to true)
// if another flush operation is already executing. The default is false
// and will cause an exception to be thrown on the shard level if another
// flush operation is already running. [1.4.0.Beta1]
func (s *FlushService) WaitIfOngoing(wait bool) *FlushService {
	s.waitIfOngoing = &wait
	return s
}

// IgnoreUnavailable specifies whether concrete indices should be ignored
// when unavailable (e.g. missing or closed).
func (s *FlushService) IgnoreUnavailable(ignoreUnavailable bool) *FlushService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// AllowNoIndices specifies whether to ignore if a wildcard expression
// yields no indices. This includes the _all index or when no indices
// have been specified.
func (s *FlushService) AllowNoIndices(allowNoIndices bool) *FlushService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards specifies whether to expand wildcards to concrete indices
// that are open, closed, or both. Use one of "open", "closed", "none", or "all".
func (s *FlushService) ExpandWildcards(expandWildcards string) *FlushService {
	s.expandWildcards = expandWildcards
	return s
}

// Do executes the service.
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
	if s.force != nil {
		params.Set("force", fmt.Sprintf("%v", *s.force))
	}
	if s.full != nil {
		params.Set("full", fmt.Sprintf("%v", *s.full))
	}
	if s.waitIfOngoing != nil {
		params.Set("wait_if_ongoing", fmt.Sprintf("%v", *s.waitIfOngoing))
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
