// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

type DeleteIndexService struct {
	client *Client
	index  string
}

func NewDeleteIndexService(client *Client) *DeleteIndexService {
	builder := &DeleteIndexService{
		client: client,
	}
	return builder
}

func (b *DeleteIndexService) Index(index string) *DeleteIndexService {
	b.index = index
	return b
}

func (b *DeleteIndexService) Do() (*DeleteIndexResult, error) {
	// Build url
	path, err := uritemplates.Expand("/{index}/", map[string]string{
		"index": b.index,
	})
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := b.client.PerformRequest("DELETE", path, nil, nil)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(DeleteIndexResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a delete index request.

type DeleteIndexResult struct {
	Acknowledged bool `json:"acknowledged"`
}
