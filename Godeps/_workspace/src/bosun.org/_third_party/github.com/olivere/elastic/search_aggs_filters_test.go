// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFiltersAggregation(t *testing.T) {
	f1 := NewRangeFilter("stock").Gt(0)
	f2 := NewTermFilter("symbol", "GOOG")
	agg := NewFiltersAggregation().Filters(f1, f2)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"filters":{"filters":[{"range":{"stock":{"from":0,"include_lower":false,"include_upper":true,"to":null}}},{"term":{"symbol":"GOOG"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFiltersAggregationWithSubAggregation(t *testing.T) {
	avgPriceAgg := NewAvgAggregation().Field("price")
	f1 := NewRangeFilter("stock").Gt(0)
	f2 := NewTermFilter("symbol", "GOOG")
	agg := NewFiltersAggregation().Filters(f1, f2).SubAggregation("avg_price", avgPriceAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_price":{"avg":{"field":"price"}}},"filters":{"filters":[{"range":{"stock":{"from":0,"include_lower":false,"include_upper":true,"to":null}}},{"term":{"symbol":"GOOG"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
