// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestChildrenAggregation(t *testing.T) {
	agg := NewChildrenAggregation().Type("answer")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"type":"answer"}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestChildrenAggregationWithSubAggregation(t *testing.T) {
	subAgg := NewTermsAggregation().Field("owner.display_name").Size(10)
	agg := NewChildrenAggregation().Type("answer")
	agg = agg.SubAggregation("top-names", subAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"top-names":{"terms":{"field":"owner.display_name","size":10}}},"type":"answer"}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
