// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestGeoDistanceFilter(t *testing.T) {
	f := NewGeoDistanceFilter("pin.location")
	f = f.Lat(40)
	f = f.Lon(-70)
	f = f.Distance("200km")
	f = f.DistanceType("plane")
	f = f.OptimizeBbox("memory")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"distance":"200km","distance_type":"plane","optimize_bbox":"memory","pin.location":{"lat":40,"lon":-70}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestGeoDistanceFilterWithGeoPoint(t *testing.T) {
	f := NewGeoDistanceFilter("pin.location")
	f = f.GeoPoint(GeoPointFromLatLon(40, -70))
	f = f.Distance("200km")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"distance":"200km","pin.location":{"lat":40,"lon":-70}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestGeoDistanceFilterWithGeoHash(t *testing.T) {
	f := NewGeoDistanceFilter("pin.location")
	f = f.GeoHash("drm3btev3e86")
	f = f.Distance("12km")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"geo_distance":{"distance":"12km","pin.location":"drm3btev3e86"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
