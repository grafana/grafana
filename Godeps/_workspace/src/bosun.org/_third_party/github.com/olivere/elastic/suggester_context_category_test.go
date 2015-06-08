// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSuggesterCategoryMapping(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").
		DefaultValues("red")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":"red","type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryMappingWithTwoDefaultValues(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").
		DefaultValues("red", "orange")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":["red","orange"],"type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryMappingWithFieldName(t *testing.T) {
	q := NewSuggesterCategoryMapping("color").
		DefaultValues("red", "orange").
		FieldName("color_field")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":{"default":["red","orange"],"path":"color_field","type":"category"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryQuery(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":"red"}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSuggesterCategoryQueryWithTwoValues(t *testing.T) {
	q := NewSuggesterCategoryQuery("color", "red", "yellow")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"color":["red","yellow"]}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
