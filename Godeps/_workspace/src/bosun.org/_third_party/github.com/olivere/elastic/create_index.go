// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"errors"
	"net/url"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

// CreateIndexService creates a new index.
type CreateIndexService struct {
	client        *Client
	pretty        bool
	index         string
	timeout       string
	masterTimeout string
	bodyJson      interface{}
	bodyString    string
}

// NewCreateIndexService returns a new CreateIndexService.
func NewCreateIndexService(client *Client) *CreateIndexService {
	return &CreateIndexService{client: client}
}

// Index is the name of the index to create.
func (b *CreateIndexService) Index(index string) *CreateIndexService {
	b.index = index
	return b
}

// Timeout the explicit operation timeout, e.g. "5s".
func (s *CreateIndexService) Timeout(timeout string) *CreateIndexService {
	s.timeout = timeout
	return s
}

// MasterTimeout specifies the timeout for connection to master.
func (s *CreateIndexService) MasterTimeout(masterTimeout string) *CreateIndexService {
	s.masterTimeout = masterTimeout
	return s
}

// Body specifies the configuration of the index as a string.
// It is an alias for BodyString.
func (b *CreateIndexService) Body(body string) *CreateIndexService {
	b.bodyString = body
	return b
}

// BodyString specifies the configuration of the index as a string.
func (b *CreateIndexService) BodyString(body string) *CreateIndexService {
	b.bodyString = body
	return b
}

// BodyJson specifies the configuration of the index. The interface{} will
// be serializes as a JSON document, so use a map[string]interface{}.
func (b *CreateIndexService) BodyJson(body interface{}) *CreateIndexService {
	b.bodyJson = body
	return b
}

// Pretty indicates that the JSON response be indented and human readable.
func (b *CreateIndexService) Pretty(pretty bool) *CreateIndexService {
	b.pretty = pretty
	return b
}

// Do executes the operation.
func (b *CreateIndexService) Do() (*CreateIndexResult, error) {
	if b.index == "" {
		return nil, errors.New("missing index name")
	}

	// Build url
	path, err := uritemplates.Expand("/{index}", map[string]string{
		"index": b.index,
	})
	if err != nil {
		return nil, err
	}

	params := make(url.Values)
	if b.pretty {
		params.Set("pretty", "1")
	}
	if b.masterTimeout != "" {
		params.Set("master_timeout", b.masterTimeout)
	}
	if b.timeout != "" {
		params.Set("timeout", b.timeout)
	}

	// Setup HTTP request body
	var body interface{}
	if b.bodyJson != nil {
		body = b.bodyJson
	} else {
		body = b.bodyString
	}

	// Get response
	res, err := b.client.PerformRequest("PUT", path, params, body)
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

// CreateIndexResult is the outcome of creating a new index.
type CreateIndexResult struct {
	Acknowledged bool `json:"acknowledged"`
}
