// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSortInfo(t *testing.T) {
	builder := SortInfo{Field: "grade", Ascending: false}
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"grade":{"order":"desc"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestScoreSort(t *testing.T) {
	builder := NewScoreSort()
	if builder.ascending != false {
		t.Error("expected score sorter to be ascending by default")
	}
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"_score":{}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestScoreSortAscending(t *testing.T) {
	builder := NewScoreSort().Asc()
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"_score":{"reverse":true}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFieldSort(t *testing.T) {
	builder := NewFieldSort("grade")
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"grade":{"order":"asc"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFieldSortDesc(t *testing.T) {
	builder := NewFieldSort("grade").Desc()
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"grade":{"order":"desc"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFieldSortComplex(t *testing.T) {
	builder := NewFieldSort("price").Desc().
		SortMode("avg").
		Missing("_last").
		UnmappedType("product").
		NestedFilter(NewTermFilter("product.color", "blue")).
		NestedPath("variant")
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"price":{"missing":"_last","mode":"avg","nested_filter":{"term":{"product.color":"blue"}},"nested_path":"variant","order":"desc","unmapped_type":"product"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestGeoDistanceSort(t *testing.T) {
	builder := NewGeoDistanceSort("pin.location").
		Point(-70, 40).
		Order(true).
		Unit("km").
		SortMode("min").
		GeoDistance("sloppy_arc")
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"_geo_distance":{"distance_type":"sloppy_arc","mode":"min","pin.location":[{"lat":-70,"lon":40}],"unit":"km"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestScriptSort(t *testing.T) {
	builder := NewScriptSort("doc['field_name'].value * factor", "number").
		Param("factor", 1.1).
		Order(true)
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"_script":{"params":{"factor":1.1},"script":"doc['field_name'].value * factor","type":"number"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
