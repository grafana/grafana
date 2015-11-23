// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestStatisticalScriptFacet(t *testing.T) {
	f := NewStatisticalScriptFacet().Script("doc['num1'].value + doc['num2'].value")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"statistical":{"script":"doc['num1'].value + doc['num2'].value"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestStatisticalScriptFacetWithGlobals(t *testing.T) {
	f := NewStatisticalScriptFacet().Script("doc['num1'].value + doc['num2'].value").
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"global":true,"statistical":{"script":"doc['num1'].value + doc['num2'].value"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
