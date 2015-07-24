// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"

	u "github.com/araddon/gou"
)

var (
	_ = u.DEBUG
)

/*
"facets": {
    "terms": {
		"terms": {
			"field": [
			  "@fields.category"
			],
			"size": 25
		}
    }
}


"facets": {
  "actors": { "terms": {"field": ["actor"],"size": "10" }}
  , "langauge": { "terms": {"field": ["repository.language"],"size": "10" }}
}

*/
func Facet() *FacetDsl {
	return &FacetDsl{}
}

func FacetRange(field string) *RangeDsl {
	out := &RangeDsl{&RangeDef{}, nil}
	out.RangeDef.Field = field
	return out
}

type FacetDsl struct {
	size   string
	Terms  map[string]*Term     `json:"terms,omitempty"`
	Ranges map[string]*RangeDsl `json:"terms,omitempty"`
}

type RangeDsl struct {
	RangeDef  *RangeDef   `json:"range,omitempty"`
	FilterVal *FilterWrap `json:"facet_filter,omitempty"`
}

type RangeDef struct {
	Field  string      `json:"field,omitempty"`
	Values []*RangeVal `json:"ranges,omitempty"`
}

type RangeVal struct {
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
}

func (m *RangeDsl) Range(from, to string) *RangeDsl {
	if len(m.RangeDef.Values) == 0 {
		m.RangeDef.Values = make([]*RangeVal, 0)
	}

	m.RangeDef.Values = append(m.RangeDef.Values, &RangeVal{From: from, To: to})
	return m
}

func (s *RangeDsl) Filter(fl ...interface{}) *RangeDsl {
	if s.FilterVal == nil {
		s.FilterVal = NewFilterWrap()
	}

	s.FilterVal.addFilters(fl)
	return s
}

func (m *FacetDsl) Size(size string) *FacetDsl {
	m.size = size
	return m
}

func (m *FacetDsl) Fields(fields ...string) *FacetDsl {
	if len(fields) < 1 {
		return m
	}
	if len(m.Terms) == 0 {
		m.Terms = make(map[string]*Term)
	}
	m.Terms[fields[0]] = &Term{Terms{Fields: fields}, nil}
	return m
}

func (m *FacetDsl) Regex(field, match string) *FacetDsl {
	if len(m.Terms) == 0 {
		m.Terms = make(map[string]*Term)
	}
	m.Terms[field] = &Term{Terms{Fields: []string{field}, Regex: match}, nil}
	return m
}

func (m *FacetDsl) Term(t *Term) *FacetDsl {
	if len(m.Terms) == 0 {
		m.Terms = make(map[string]*Term)
	}
	m.Terms[t.Terms.Fields[0]] = t
	return m
}

func (m *FacetDsl) Range(r *RangeDsl) *FacetDsl {
	if len(m.Ranges) == 0 {
		m.Ranges = make(map[string]*RangeDsl)
	}
	m.Ranges[r.RangeDef.Field] = r
	return m
}

func (m *FacetDsl) MarshalJSON() ([]byte, error) {
	data := map[string]interface{}{}
	for key, t := range m.Terms {
		t.Terms.Size = m.size
		data[key] = t
	}
	for key, r := range m.Ranges {
		data[key] = r
	}
	return json.Marshal(&data)
}
