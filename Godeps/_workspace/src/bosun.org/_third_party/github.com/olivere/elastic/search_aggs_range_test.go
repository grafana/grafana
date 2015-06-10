// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestRangeAggregation(t *testing.T) {
	agg := NewRangeAggregation().Field("price")
	agg = agg.AddRange(nil, 50)
	agg = agg.AddRange(50, 100)
	agg = agg.AddRange(100, nil)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"price","ranges":[{"to":50},{"from":50,"to":100},{"from":100}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeAggregationWithUnbounded(t *testing.T) {
	agg := NewRangeAggregation().Field("field_name").
		AddUnboundedFrom(50).
		AddRange(20, 70).
		AddRange(70, 120).
		AddUnboundedTo(150)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeAggregationWithLtAndCo(t *testing.T) {
	agg := NewRangeAggregation().Field("field_name").
		Lt(50).
		Between(20, 70).
		Between(70, 120).
		Gt(150)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeAggregationWithKeyedFlag(t *testing.T) {
	agg := NewRangeAggregation().Field("field_name").
		Keyed(true).
		Lt(50).
		Between(20, 70).
		Between(70, 120).
		Gt(150)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","keyed":true,"ranges":[{"to":50},{"from":20,"to":70},{"from":70,"to":120},{"from":150}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRangeAggregationWithKeys(t *testing.T) {
	agg := NewRangeAggregation().Field("field_name").
		Keyed(true).
		LtWithKey("cheap", 50).
		BetweenWithKey("affordable", 20, 70).
		BetweenWithKey("average", 70, 120).
		GtWithKey("expensive", 150)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"range":{"field":"field_name","keyed":true,"ranges":[{"key":"cheap","to":50},{"from":20,"key":"affordable","to":70},{"from":70,"key":"average","to":120},{"from":150,"key":"expensive"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
