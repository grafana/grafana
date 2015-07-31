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
	"fmt"
	"github.com/bmizerany/assert"
	"testing"
)

func ok(t *testing.T, err error) {
	if err != nil {
		t.Fatal(err)
	}
}

func TestSearchResultToJSON(t *testing.T) {
	c := NewTestConn()

	qry := map[string]interface{}{
		"query": map[string]interface{}{
			"wildcard": map[string]string{"actor": "a*"},
		},
	}
	var args map[string]interface{}
	out, err := c.Search("github", "", args, qry)
	ok(t, err)

	_, err = json.Marshal(out.Hits.Hits)
	ok(t, err)
}

type SuggestTest struct {
	Completion string `json:"completion"`
}

type hash map[string]interface{}

func TestSuggest(t *testing.T) {
	c := NewTestConn()
	mappingOpts := MappingOptions{Properties: hash{
		"completion": hash{
			"type": "completion",
		},
	}}
	err := c.PutMapping("github", "SuggestTest", SuggestTest{}, mappingOpts)
	ok(t, err)

	_, err = c.UpdateWithPartialDoc("github", "SuggestTest", "1", nil, SuggestTest{"foobar"}, true)
	ok(t, err)

	query := hash{"completion_completion": hash{
		"text": "foo",
		"completion": hash{
			"size":  10,
			"field": "completion",
		},
	}}

	_, err = c.Refresh("github")
	ok(t, err)

	res, err := c.Suggest("github", nil, query)
	ok(t, err)

	opts, err := res.Result("completion_completion")
	ok(t, err)

	first := opts[0]
	assert.T(t, len(first.Options) > 0, "Length of first.Options was 0.")
	text := first.Options[0].Text
	assert.T(t, text == "foobar", fmt.Sprintf("Expected foobar, got: %s", text))
}
