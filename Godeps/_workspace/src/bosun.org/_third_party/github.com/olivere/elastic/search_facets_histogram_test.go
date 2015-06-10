// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestHistogramFacetWithField(t *testing.T) {
	f := NewHistogramFacet().Field("field_name").Interval(100)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"histogram":{"field":"field_name","interval":100}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHistogramFacetWithValueField(t *testing.T) {
	f := NewHistogramFacet().
		KeyField("timestamp").
		ValueField("price").
		TimeInterval("1.5d")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"histogram":{"key_field":"timestamp","time_interval":"1.5d","value_field":"price"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHistogramFacetWithGlobals(t *testing.T) {
	f := NewHistogramFacet().
		KeyField("timestamp").
		ValueField("price").
		Interval(1000).
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"global":true,"histogram":{"interval":1000,"key_field":"timestamp","value_field":"price"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
