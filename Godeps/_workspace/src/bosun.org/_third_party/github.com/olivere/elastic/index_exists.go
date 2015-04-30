// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"

	"bosun.org/_third_party/github.com/olivere/elastic/uritemplates"
)

type IndexExistsService struct {
	client *Client
	index  string
}

func NewIndexExistsService(client *Client) *IndexExistsService {
	builder := &IndexExistsService{
		client: client,
	}
	return builder
}

func (b *IndexExistsService) Index(index string) *IndexExistsService {
	b.index = index
	return b
}

func (b *IndexExistsService) Do() (bool, error) {
	// Build url
	path, err := uritemplates.Expand("/{index}", map[string]string{
		"index": b.index,
	})
	if err != nil {
		return false, err
	}

	// Get response
	res, err := b.client.PerformRequest("HEAD", path, nil, nil)
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
