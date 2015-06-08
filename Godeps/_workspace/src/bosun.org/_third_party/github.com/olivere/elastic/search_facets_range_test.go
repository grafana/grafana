// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestRangeFacet(t *testing.T) {
	f := NewRangeFacet().Field("field_name").
		AddUnboundedFrom(50).
		AddRange(20, 70).
		AddRange(70, 120).
		AddUnboundedTo(150)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeFacetWithLtAndCo(t *testing.T) {
	f := NewRangeFacet().Field("field_name").
		Lt(50).
		Between(20, 70).
		Between(70, 120).
		Gt(150)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeFacetWithGlobals(t *testing.T) {
	f := NewRangeFacet().Field("field_name").
		AddUnboundedFrom(50).
		AddRange(20, 70).
		AddRange(70, 120).
		AddUnboundedTo(150).
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"global":true,"range":{"field":"field_name","ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
