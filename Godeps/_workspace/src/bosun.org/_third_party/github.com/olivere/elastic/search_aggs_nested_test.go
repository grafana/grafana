// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestNestedAggregation(t *testing.T) {
	agg := NewNestedAggregation().Path("resellers")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"nested":{"path":"resellers"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestNestedAggregationWithSubAggregation(t *testing.T) {
	minPriceAgg := NewMinAggregation().Field("resellers.price")
	agg := NewNestedAggregation().Path("resellers").SubAggregation("min_price", minPriceAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"min_price":{"min":{"field":"resellers.price"}}},"nested":{"path":"resellers"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
