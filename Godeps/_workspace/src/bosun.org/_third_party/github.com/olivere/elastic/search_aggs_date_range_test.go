// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestDateRangeAggregation(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at")
	agg = agg.AddRange(nil, "2012-12-31")
	agg = agg.AddRange("2013-01-01", "2013-12-31")
	agg = agg.AddRange("2014-01-01", nil)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","ranges":[{"to":"2012-12-31"},{"from":"2013-01-01","to":"2013-12-31"},{"from":"2014-01-01"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateRangeAggregationWithUnbounded(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at").
		AddUnboundedFrom("2012-12-31").
		AddRange("2013-01-01", "2013-12-31").
		AddUnboundedTo("2014-01-01")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","ranges":[{"to":"2012-12-31"},{"from":"2013-01-01","to":"2013-12-31"},{"from":"2014-01-01"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateRangeAggregationWithLtAndCo(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at").
		Lt("2012-12-31").
		Between("2013-01-01", "2013-12-31").
		Gt("2014-01-01")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","ranges":[{"to":"2012-12-31"},{"from":"2013-01-01","to":"2013-12-31"},{"from":"2014-01-01"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateRangeAggregationWithKeyedFlag(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at").
		Keyed(true).
		Lt("2012-12-31").
		Between("2013-01-01", "2013-12-31").
		Gt("2014-01-01")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","keyed":true,"ranges":[{"to":"2012-12-31"},{"from":"2013-01-01","to":"2013-12-31"},{"from":"2014-01-01"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateRangeAggregationWithKeys(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at").
		Keyed(true).
		LtWithKey("pre-2012", "2012-12-31").
		BetweenWithKey("2013", "2013-01-01", "2013-12-31").
		GtWithKey("post-2013", "2014-01-01")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","keyed":true,"ranges":[{"key":"pre-2012","to":"2012-12-31"},{"from":"2013-01-01","key":"2013","to":"2013-12-31"},{"from":"2014-01-01","key":"post-2013"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestDateRangeAggregationWithSpecialNames(t *testing.T) {
	agg := NewDateRangeAggregation().Field("created_at").
		AddRange("now-10M/M", "now+10M/M")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"date_range":{"field":"created_at","ranges":[{"from":"now-10M/M","to":"now+10M/M"}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
