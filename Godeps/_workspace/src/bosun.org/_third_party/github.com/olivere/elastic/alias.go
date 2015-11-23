// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
)

type AliasService struct {
	client  *Client
	actions []aliasAction
	pretty  bool
}

type aliasAction struct {
	// "add" or "remove"
	Type string
	// Index name
	Index string
	// Alias name
	Alias string
	// Filter
	Filter *Filter
}

func NewAliasService(client *Client) *AliasService {
	builder := &AliasService{
		client:  client,
		actions: make([]aliasAction, 0),
	}
	return builder
}

func (s *AliasService) Pretty(pretty bool) *AliasService {
	s.pretty = pretty
	return s
}

func (s *AliasService) Add(indexName string, aliasName string) *AliasService {
	action := aliasAction{Type: "add", Index: indexName, Alias: aliasName}
	s.actions = append(s.actions, action)
	return s
}

func (s *AliasService) AddWithFilter(indexName string, aliasName string, filter *Filter) *AliasService {
	action := aliasAction{Type: "add", Index: indexName, Alias: aliasName, Filter: filter}
	s.actions = append(s.actions, action)
	return s
}

func (s *AliasService) Remove(indexName string, aliasName string) *AliasService {
	action := aliasAction{Type: "remove", Index: indexName, Alias: aliasName}
	s.actions = append(s.actions, action)
	return s
}

func (s *AliasService) Do() (*AliasResult, error) {
	// Build url
	path := "/_aliases"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}

	// Actions
	body := make(map[string]interface{})
	actionsJson := make([]interface{}, 0)

	for _, action := range s.actions {
		actionJson := make(map[string]interface{})
		detailsJson := make(map[string]interface{})
		detailsJson["index"] = action.Index
		detailsJson["alias"] = action.Alias
		if action.Filter != nil {
			detailsJson["filter"] = (*action.Filter).Source()
		}
		actionJson[action.Type] = detailsJson
		actionsJson = append(actionsJson, actionJson)
	}

	body["actions"] = actionsJson

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return results
	ret := new(AliasResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of an alias request.

type AliasResult struct {
	Acknowledged bool `json:"acknowledged"`
}
