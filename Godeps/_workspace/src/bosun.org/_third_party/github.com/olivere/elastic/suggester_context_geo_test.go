// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSuggesterGeoMapping(t *testing.T) {
	q := NewSuggesterGeoMapping("location").
		Precision("1km", "5m").
		Neighbors(true).
		FieldName("pin").
		DefaultLocations(GeoPointFromLatLon(0.0, 0.0))
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"location":{"default":{"lat":0,"lon":0},"neighbors":true,"path":"pin","precision":["1km","5m"],"type":"geo"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterGeoQuery(t *testing.T) {
	q := NewSuggesterGeoQuery("location", GeoPointFromLatLon(11.5, 62.71)).
		Precision("1km")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"location":{"precision":"1km","value":{"lat":11.5,"lon":62.71}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
