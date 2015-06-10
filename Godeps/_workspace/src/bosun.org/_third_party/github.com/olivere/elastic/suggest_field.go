// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
)

// SuggestField can be used by the caller to specify a suggest field
// at index time. For a detailed example, see e.g.
// http://www.elasticsearch.org/blog/you-complete-me/.
type SuggestField struct {
	inputs  []string
	output  *string
	payload interface{}
	weight  int
}

func NewSuggestField() *SuggestField {
	return &SuggestField{weight: -1}
}

func (f *SuggestField) Input(input ...string) *SuggestField {
	if f.inputs == nil {
		f.inputs = make([]string, 0)
	}
	f.inputs = append(f.inputs, input...)
	return f
}

func (f *SuggestField) Output(output string) *SuggestField {
	f.output = &output
	return f
}

func (f *SuggestField) Payload(payload interface{}) *SuggestField {
	f.payload = payload
	return f
}

func (f *SuggestField) Weight(weight int) *SuggestField {
	f.weight = weight
	return f
}

// MarshalJSON encodes SuggestField into JSON.
func (f *SuggestField) MarshalJSON() ([]byte, error) {
	source := make(map[string]interface{})

	if f.inputs != nil {
		switch len(f.inputs) {
		case 1:
			source["input"] = f.inputs[0]
		default:
			source["input"] = f.inputs
		}
	}

	if f.output != nil {
		source["output"] = *f.output
	}

	if f.payload != nil {
		source["payload"] = f.payload
	}

	if f.weight >= 0 {
		source["weight"] = f.weight
	}

	return json.Marshal(source)
}
