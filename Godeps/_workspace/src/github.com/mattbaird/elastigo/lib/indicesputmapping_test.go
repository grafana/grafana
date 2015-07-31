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
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sort"
	"strings"
	"testing"
)

var (
	mux    *http.ServeMux
	server *httptest.Server
)

func setup(t *testing.T) *Conn {
	mux = http.NewServeMux()
	server = httptest.NewServer(mux)
	c := NewTestConn()

	serverURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("Error: %v", err)
	}

	c.Domain = strings.Split(serverURL.Host, ":")[0]
	c.Port = strings.Split(serverURL.Host, ":")[1]

	return c
}

func teardown() {
	server.Close()
}

type TestStruct struct {
	Id            string `json:"id" elastic:"index:not_analyzed"`
	DontIndex     string `json:"dontIndex" elastic:"index:no"`
	Number        int    `json:"number" elastic:"type:integer,index:analyzed"`
	Omitted       string `json:"-"`
	NoJson        string `elastic:"type:string"`
	unexported    string
	JsonOmitEmpty string `json:"jsonOmitEmpty,omitempty" elastic:"type:string"`
	Embedded
	Inner        InnerStruct   `json:"inner"`
	InnerP       *InnerStruct  `json:"pointer_to_inner"`
	InnerS       []InnerStruct `json:"slice_of_inner"`
	MultiAnalyze string        `json:"multi_analyze"`
	NestedObject NestedStruct  `json:"nestedObject" elastic:"type:nested"`
}

type Embedded struct {
	EmbeddedField string `json:"embeddedField" elastic:"type:string"`
}

type InnerStruct struct {
	InnerField string `json:"innerField" elastic:"type:date"`
}

type NestedStruct struct {
	InnerField string `json:"innerField" elastic:"type:date"`
}

// Sorting string
// RuneSlice implements sort.Interface (http://golang.org/pkg/sort/#Interface)
type RuneSlice []rune

func (p RuneSlice) Len() int           { return len(p) }
func (p RuneSlice) Less(i, j int) bool { return p[i] < p[j] }
func (p RuneSlice) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }

// sorted func returns string with sorted characters
func sorted(s string) string {
	runes := []rune(s)
	sort.Sort(RuneSlice(runes))
	return string(runes)
}

func TestPutMapping(t *testing.T) {
	c := setup(t)
	defer teardown()

	options := MappingOptions{
		Timestamp: TimestampOptions{Enabled: true},
		Id:        IdOptions{Index: "analyzed", Path: "id"},
		Parent:    &ParentOptions{Type: "testParent"},
		Properties: map[string]interface{}{
			// special properties that can't be expressed as tags
			"multi_analyze": map[string]interface{}{
				"type": "multi_field",
				"fields": map[string]map[string]string{
					"ma_analyzed":    {"type": "string", "index": "analyzed"},
					"ma_notanalyzed": {"type": "string", "index": "not_analyzed"},
				},
			},
		},
	}
	expValue := MappingForType("myType", MappingOptions{
		Timestamp: TimestampOptions{Enabled: true},
		Id:        IdOptions{Index: "analyzed", Path: "id"},
		Parent:    &ParentOptions{Type: "testParent"},
		Properties: map[string]interface{}{
			"NoJson":        map[string]string{"type": "string"},
			"dontIndex":     map[string]string{"index": "no"},
			"embeddedField": map[string]string{"type": "string"},
			"id":            map[string]string{"index": "not_analyzed"},
			"jsonOmitEmpty": map[string]string{"type": "string"},
			"number":        map[string]string{"index": "analyzed", "type": "integer"},
			"multi_analyze": map[string]interface{}{
				"type": "multi_field",
				"fields": map[string]map[string]string{
					"ma_analyzed":    {"type": "string", "index": "analyzed"},
					"ma_notanalyzed": {"type": "string", "index": "not_analyzed"},
				},
			},
			"inner": map[string]map[string]map[string]string{
				"properties": {
					"innerField": {"type": "date"},
				},
			},
			"pointer_to_inner": map[string]map[string]map[string]string{
				"properties": {
					"innerField": {"type": "date"},
				},
			},
			"slice_of_inner": map[string]map[string]map[string]string{
				"properties": {
					"innerField": {"type": "date"},
				},
			},
			"nestedObject": map[string]interface{}{
				"type": "nested",
				"properties": map[string]map[string]string{
					"innerField": {"type": "date"},
				},
			},
		},
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var value map[string]interface{}
		bd, err := ioutil.ReadAll(r.Body)
		json.NewDecoder(strings.NewReader(string(bd))).Decode(&value)
		expValJson, err := json.MarshalIndent(expValue, "", "  ")
		if err != nil {
			t.Errorf("Got error: %v", err)
		}
		valJson, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			t.Errorf("Got error: %v", err)
		}

		if sorted(string(expValJson)) != sorted(string(valJson)) {
			t.Errorf("Expected %s but got %s", string(expValJson), string(valJson))
		}
	})

	err := c.PutMapping("myIndex", "myType", TestStruct{}, options)
	if err != nil {
		t.Errorf("Error: %v", err)
	}
}

type StructWithEmptyElasticTag struct {
	Field string `json:"field" elastic:""`
}

func TestPutMapping_empty_elastic_tag_is_accepted(t *testing.T) {
	properties := map[string]interface{}{}
	getProperties(reflect.TypeOf(StructWithEmptyElasticTag{}), properties)
	if len(properties) != 0 {
		t.Errorf("Expected empty properites but got: %v", properties)
	}
}
