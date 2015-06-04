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

type GetService struct {
	client                        *Client
	index                         string
	typ                           string
	id                            string
	routing                       string
	preference                    string
	fields                        []string
	refresh                       *bool
	realtime                      *bool
	fsc                           *FetchSourceContext
	versionType                   string
	version                       *int64
	ignoreErrorsOnGeneratedFields *bool
}

func NewGetService(client *Client) *GetService {
	builder := &GetService{
		client: client,
		typ:    "_all",
	}
	return builder
}

func (b *GetService) String() string {
	return fmt.Sprintf("[%v][%v][%v]: routing [%v]",
		b.index,
		b.typ,
		b.id,
		b.routing)
}

func (b *GetService) Index(index string) *GetService {
	b.index = index
	return b
}

func (b *GetService) Type(typ string) *GetService {
	b.typ = typ
	return b
}

func (b *GetService) Id(id string) *GetService {
	b.id = id
	return b
}

func (b *GetService) Parent(parent string) *GetService {
	if b.routing == "" {
		b.routing = parent
	}
	return b
}

func (b *GetService) Routing(routing string) *GetService {
	b.routing = routing
	return b
}

func (b *GetService) Preference(preference string) *GetService {
	b.preference = preference
	return b
}

func (b *GetService) Fields(fields ...string) *GetService {
	if b.fields == nil {
		b.fields = make([]string, 0)
	}
	b.fields = append(b.fields, fields...)
	return b
}

func (s *GetService) FetchSource(fetchSource bool) *GetService {
	if s.fsc == nil {
		s.fsc = NewFetchSourceContext(fetchSource)
	} else {
		s.fsc.SetFetchSource(fetchSource)
	}
	return s
}

func (s *GetService) FetchSourceContext(fetchSourceContext *FetchSourceContext) *GetService {
	s.fsc = fetchSourceContext
	return s
}

func (b *GetService) Refresh(refresh bool) *GetService {
	b.refresh = &refresh
	return b
}

func (b *GetService) Realtime(realtime bool) *GetService {
	b.realtime = &realtime
	return b
}

func (b *GetService) VersionType(versionType string) *GetService {
	b.versionType = versionType
	return b
}

func (b *GetService) Version(version int64) *GetService {
	b.version = &version
	return b
}

func (b *GetService) IgnoreErrorsOnGeneratedFields(ignore bool) *GetService {
	b.ignoreErrorsOnGeneratedFields = &ignore
	return b
}

func (b *GetService) Do() (*GetResult, error) {
	// Build url
	path, err := uritemplates.Expand("/{index}/{type}/{id}", map[string]string{
		"index": b.index,
		"type":  b.typ,
		"id":    b.id,
	})
	if err != nil {
		return nil, err
	}

	params := make(url.Values)
	if b.realtime != nil {
		params.Add("realtime", fmt.Sprintf("%v", *b.realtime))
	}
	if len(b.fields) > 0 {
		params.Add("fields", strings.Join(b.fields, ","))
	}
	if b.routing != "" {
		params.Add("routing", b.routing)
	}
	if b.preference != "" {
		params.Add("preference", b.preference)
	}
	if b.refresh != nil {
		params.Add("refresh", fmt.Sprintf("%v", *b.refresh))
	}
	if b.realtime != nil {
		params.Add("realtime", fmt.Sprintf("%v", *b.realtime))
	}
	if b.ignoreErrorsOnGeneratedFields != nil {
		params.Add("ignore_errors_on_generated_fields", fmt.Sprintf("%v", *b.ignoreErrorsOnGeneratedFields))
	}
	if len(b.fields) > 0 {
		params.Add("_fields", strings.Join(b.fields, ","))
	}
	if b.version != nil {
		params.Add("version", fmt.Sprintf("%d", *b.version))
	}
	if b.versionType != "" {
		params.Add("version_type", b.versionType)
	}
	if b.fsc != nil {
		for k, values := range b.fsc.Query() {
			params.Add(k, strings.Join(values, ","))
		}
	}

	// Get response
	res, err := b.client.PerformRequest("GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(GetResult)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a get request.

type GetResult struct {
	Index   string           `json:"_index"`
	Type    string           `json:"_type"`
	Id      string           `json:"_id"`
	Version int64            `json:"_version,omitempty"`
	Source  *json.RawMessage `json:"_source,omitempty"`
	Found   bool             `json:"found,omitempty"`
	Fields  []string         `json:"fields,omitempty"`
	Error   string           `json:"error,omitempty"` // used only in MultiGet
}
