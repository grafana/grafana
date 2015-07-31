// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTermsAggregation(t *testing.T) {
	agg := NewTermsAggregation().Field("gender").Size(10).OrderByTermDesc()
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"field":"gender","order":{"_term":"desc"},"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithSubAggregation(t *testing.T) {
	subAgg := NewAvgAggregation().Field("height")
	agg := NewTermsAggregation().Field("gender").Size(10).
		OrderByAggregation("avg_height", false)
	agg = agg.SubAggregation("avg_height", subAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_height":{"avg":{"field":"height"}}},"terms":{"field":"gender","order":{"avg_height":"desc"},"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestTermsAggregationWithMultipleSubAggregation(t *testing.T) {
	subAgg1 := NewAvgAggregation().Field("height")
	subAgg2 := NewAvgAggregation().Field("width")
	agg := NewTermsAggregation().Field("gender").Size(10).
		OrderByAggregation("avg_height", false)
	agg = agg.SubAggregation("avg_height", subAgg1)
	agg = agg.SubAggregation("avg_width", subAgg2)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"avg_height":{"avg":{"field":"height"}},"avg_width":{"avg":{"field":"width"}}},"terms":{"field":"gender","order":{"avg_height":"desc"},"size":10}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
