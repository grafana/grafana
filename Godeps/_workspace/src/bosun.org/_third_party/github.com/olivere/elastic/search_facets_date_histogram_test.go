// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestDateHistogramFacetWithField(t *testing.T) {
	f := NewDateHistogramFacet().Field("field_name").Interval("day")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_histogram":{"field":"field_name","interval":"day"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateHistogramFacetWithValueField(t *testing.T) {
	f := NewDateHistogramFacet().
		KeyField("timestamp").
		ValueField("price").
		Interval("day")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_histogram":{"interval":"day","key_field":"timestamp","value_field":"price"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateHistogramFacetWithGlobals(t *testing.T) {
	f := NewDateHistogramFacet().
		KeyField("timestamp").
		ValueField("price").
		Interval("day").
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_histogram":{"interval":"day","key_field":"timestamp","value_field":"price"},"facet_filter":{"term":{"user":"kimchy"}},"global":true}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
