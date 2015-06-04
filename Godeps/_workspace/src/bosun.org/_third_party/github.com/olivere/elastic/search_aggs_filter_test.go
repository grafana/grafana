// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFilterAggregation(t *testing.T) {
	filter := NewRangeFilter("stock").Gt(0)
	agg := NewFilterAggregation().Filter(filter)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"filter":{"range":{"stock":{"from":0,"include_lower":false,"include_upper":true,"to":null}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFilterAggregationWithSubAggregation(t *testing.T) {
	avgPriceAgg := NewAvgAggregation().Field("price")
	filter := NewRangeFilter("stock").Gt(0)
	agg := NewFilterAggregation().Filter(filter).
		SubAggregation("avg_price", avgPriceAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_price":{"avg":{"field":"price"}}},"filter":{"range":{"stock":{"from":0,"include_lower":false,"include_upper":true,"to":null}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
