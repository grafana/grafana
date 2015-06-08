// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTermsStatsFacet(t *testing.T) {
	f := NewTermsStatsFacet().KeyField("tag").ValueField("price")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms_stats":{"key_field":"tag","value_field":"price"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsStatsFacetWithGlobals(t *testing.T) {
	f := NewTermsStatsFacet().KeyField("tag").ValueField("price").
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"global":true,"terms_stats":{"key_field":"tag","value_field":"price"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
