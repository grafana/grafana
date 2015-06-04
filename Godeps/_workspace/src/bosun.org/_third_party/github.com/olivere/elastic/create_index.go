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

type CreateIndexService struct {
	client *Client
	index  string
	body   string
	pretty bool
}

func NewCreateIndexService(client *Client) *CreateIndexService {
	builder := &CreateIndexService{
		client: client,
	}
	return builder
}

func (b *CreateIndexService) Index(index string) *CreateIndexService {
	b.index = index
	return b
}

func (b *CreateIndexService) Body(body string) *CreateIndexService {
	b.body = body
	return b
}

func (b *CreateIndexService) Pretty(pretty bool) *CreateIndexService {
	b.pretty = pretty
	return b
}

func (b *CreateIndexService) Do() (*CreateIndexResult, error) {
	// Build url
	path, err := uritemplates.Expand("/{index}/", map[string]string{
		"index": b.index,
	})
	if err != nil {
		return nil, err
	}

	params := make(url.Values)
	if b.pretty {
		params.Set("pretty", fmt.Sprintf("%v", b.pretty))
	}

	// Get response
	res, err := b.client.PerformRequest("PUT", path, params, b.body)
	if err != nil {
		return nil, err
	}

	ret := new(CreateIndexResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a create index request.

type CreateIndexResult struct {
	Acknowledged bool `json:"acknowledged"`
}
