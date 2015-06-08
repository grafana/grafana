// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestCardinalityAggregation(t *testing.T) {
	agg := NewCardinalityAggregation().Field("author.hash")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"cardinality":{"field":"author.hash"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCardinalityAggregationWithOptions(t *testing.T) {
	agg := NewCardinalityAggregation().Field("author.hash").PrecisionThreshold(100).Rehash(true)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"cardinality":{"field":"author.hash","precision_threshold":100,"rehash":true}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestCardinalityAggregationWithFormat(t *testing.T) {
	agg := NewCardinalityAggregation().Field("author.hash").Format("00000")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"cardinality":{"field":"author.hash","format":"00000"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
