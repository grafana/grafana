// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestGeoDistanceAggregation(t *testing.T) {
	agg := NewGeoDistanceAggregation().Field("location").Point("52.3760, 4.894")
	agg = agg.AddRange(nil, 100)
	agg = agg.AddRange(100, 300)
	agg = agg.AddRange(300, nil)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"field":"location","origin":"52.3760, 4.894","ranges":[{"to":100},{"from":100,"to":300},{"from":300}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestGeoDistanceAggregationWithUnbounded(t *testing.T) {
	agg := NewGeoDistanceAggregation().Field("location").Point("52.3760, 4.894")
	agg = agg.AddUnboundedFrom(100)
	agg = agg.AddRange(100, 300)
	agg = agg.AddUnboundedTo(300)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"field":"location","origin":"52.3760, 4.894","ranges":[{"to":100},{"from":100,"to":300},{"from":300}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
