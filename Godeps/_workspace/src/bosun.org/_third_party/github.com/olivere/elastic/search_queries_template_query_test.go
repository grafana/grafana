// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTemplateQueryInlineTest(t *testing.T) {
	f := NewTemplateQuery("\"match_{{template}}\": {}}\"").Vars(map[string]interface{}{"template": "all"})
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"template":{"params":{"template":"all"},"query":"\"match_{{template}}\": {}}\""}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTemplateQueryIndexedTest(t *testing.T) {
	f := NewTemplateQuery("indexedTemplate").
		TemplateType("id").
		Vars(map[string]interface{}{"template": "all"})
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"template":{"id":"indexedTemplate","params":{"template":"all"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTemplateQueryFileTest(t *testing.T) {
	f := NewTemplateQuery("storedTemplate").
		TemplateType("file").
		Vars(map[string]interface{}{"template": "all"})
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"template":{"file":"storedTemplate","params":{"template":"all"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
