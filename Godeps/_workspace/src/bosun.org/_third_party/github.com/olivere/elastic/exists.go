// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

type ExistsService struct {
	client *Client
	index  string
	_type  string
	id     string
}

func NewExistsService(client *Client) *ExistsService {
	builder := &ExistsService{
		client: client,
	}
	return builder
}

func (s *ExistsService) String() string {
	return fmt.Sprintf("exists([%v][%v][%v])",
		s.index,
		s._type,
		s.id)
}

func (s *ExistsService) Index(index string) *ExistsService {
	s.index = index
	return s
}

func (s *ExistsService) Type(_type string) *ExistsService {
	s._type = _type
	return s
}

func (s *ExistsService) Id(id string) *ExistsService {
	s.id = id
	return s
}

func (s *ExistsService) Do() (bool, error) {
	// Build url
	path, err := uritemplates.Expand("/{index}/{type}/{id}", map[string]string{
		"index": s.index,
		"type":  s._type,
		"id":    s.id,
	})
	if err != nil {
		return false, err
	}

	// Get response
	res, err := s.client.PerformRequest("HEAD", path, nil, nil)
	if err != nil {
		return false, err
	}
	if res.StatusCode == 200 {
		return true, nil
	} else if res.StatusCode == 404 {
		return false, nil
	}
	return false, fmt.Errorf("elastic: got HTTP code %d when it should have been either 200 or 404", res.StatusCode)
}
