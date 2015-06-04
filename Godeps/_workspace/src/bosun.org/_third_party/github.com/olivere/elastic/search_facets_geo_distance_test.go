// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestGeoDistanceFacet(t *testing.T) {
	f := NewGeoDistanceFacet().Field("pin.location").
		Point(40, -70).
		AddUnboundedFrom(10).
		AddRange(10, 20).
		AddRange(20, 100).
		AddUnboundedTo(100)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"pin.location":[40,-70],"ranges":[{"to":10},{"from":10,"to":20},{"from":20,"to":100},{"from":100}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestGeoDistanceFacetWithGlobals(t *testing.T) {
	f := NewGeoDistanceFacet().Field("pin.location").
		Point(40, -70).
		AddUnboundedFrom(10).
		AddRange(10, 20).
		AddRange(20, 100).
		AddUnboundedTo(100).
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"geo_distance":{"pin.location":[40,-70],"ranges":[{"to":10},{"from":10,"to":20},{"from":20,"to":100},{"from":100}]},"global":true}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
