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

type AliasesService struct {
	client  *Client
	indices []string
	pretty  bool
}

func NewAliasesService(client *Client) *AliasesService {
	builder := &AliasesService{
		client:  client,
		indices: make([]string, 0),
	}
	return builder
}

func (s *AliasesService) Pretty(pretty bool) *AliasesService {
	s.pretty = pretty
	return s
}

func (s *AliasesService) Index(indexName string) *AliasesService {
	s.indices = append(s.indices, indexName)
	return s
}

func (s *AliasesService) Indices(indexNames ...string) *AliasesService {
	s.indices = append(s.indices, indexNames...)
	return s
}

func (s *AliasesService) Do() (*AliasesResult, error) {
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
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	path += strings.Join(indexPart, ",")

	// TODO Add types here

	// Search
	path += "/_aliases"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}

	// Get response
	res, err := s.client.PerformRequest("GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// {
	//   "indexName" : {
	//     "aliases" : {
	//       "alias1" : { },
	//       "alias2" : { }
	//     }
	//   },
	//   "indexName2" : {
	//     ...
	//   },
	// }
	indexMap := make(map[string]interface{})
	if err := json.Unmarshal(res.Body, &indexMap); err != nil {
		return nil, err
	}

	// Each (indexName, _)
	ret := &AliasesResult{
		Indices: make(map[string]indexResult),
	}
	for indexName, indexData := range indexMap {
		indexOut, found := ret.Indices[indexName]
		if !found {
			indexOut = indexResult{Aliases: make([]aliasResult, 0)}
		}

		// { "aliases" : { ... } }
		indexDataMap, ok := indexData.(map[string]interface{})
		if ok {
			aliasesData, ok := indexDataMap["aliases"].(map[string]interface{})
			if ok {
				for aliasName, _ := range aliasesData {
					aliasRes := aliasResult{AliasName: aliasName}
					indexOut.Aliases = append(indexOut.Aliases, aliasRes)
				}
			}
		}

		ret.Indices[indexName] = indexOut
	}

	return ret, nil
}

// -- Result of an alias request.

type AliasesResult struct {
	Indices map[string]indexResult
}

type indexResult struct {
	Aliases []aliasResult
}

type aliasResult struct {
	AliasName string
}

func (ar AliasesResult) IndicesByAlias(aliasName string) []string {
	indices := make([]string, 0)

	for indexName, indexInfo := range ar.Indices {
		for _, aliasInfo := range indexInfo.Aliases {
			if aliasInfo.AliasName == aliasName {
				indices = append(indices, indexName)
			}
		}
	}

	return indices
}

func (ir indexResult) HasAlias(aliasName string) bool {
	for _, alias := range ir.Aliases {
		if alias.AliasName == aliasName {
			return true
		}
	}
	return false
}
