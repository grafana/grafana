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

// SuggestService returns suggestions for text.
type SuggestService struct {
	client     *Client
	pretty     bool
	routing    string
	preference string
	indices    []string
	suggesters []Suggester
}

func NewSuggestService(client *Client) *SuggestService {
	builder := &SuggestService{
		client:     client,
		indices:    make([]string, 0),
		suggesters: make([]Suggester, 0),
	}
	return builder
}

func (s *SuggestService) Index(index string) *SuggestService {
	s.indices = append(s.indices, index)
	return s
}

func (s *SuggestService) Indices(indices ...string) *SuggestService {
	s.indices = append(s.indices, indices...)
	return s
}

func (s *SuggestService) Pretty(pretty bool) *SuggestService {
	s.pretty = pretty
	return s
}

func (s *SuggestService) Routing(routing string) *SuggestService {
	s.routing = routing
	return s
}

func (s *SuggestService) Preference(preference string) *SuggestService {
	s.preference = preference
	return s
}

func (s *SuggestService) Suggester(suggester Suggester) *SuggestService {
	s.suggesters = append(s.suggesters, suggester)
	return s
}

func (s *SuggestService) Do() (SuggestResult, error) {
	// Build url
	path := "/"

	// Indices part
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
	path += strings.Join(indexPart, ",")

	// Suggest
	path += "/_suggest"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}

	// Set body
	body := make(map[string]interface{})
	for _, s := range s.suggesters {
		body[s.Name()] = s.Source(false)
	}

	// Get response
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// There is a _shard object that cannot be deserialized.
	// So we use json.RawMessage instead.
	var suggestions map[string]*json.RawMessage
	if err := json.Unmarshal(res.Body, &suggestions); err != nil {
		return nil, err
	}

	ret := make(SuggestResult)
	for name, result := range suggestions {
		if name != "_shards" {
			var s []Suggestion
			if err := json.Unmarshal(*result, &s); err != nil {
				return nil, err
			}
			ret[name] = s
		}
	}

	return ret, nil
}

type SuggestResult map[string][]Suggestion

type Suggestion struct {
	Text    string             `json:"text"`
	Offset  int                `json:"offset"`
	Length  int                `json:"length"`
	Options []suggestionOption `json:"options"`
}

type suggestionOption struct {
	Text    string      `json:"text"`
	Score   float32     `json:"score"`
	Freq    int         `json:"freq"`
	Payload interface{} `json:"payload"`
}
