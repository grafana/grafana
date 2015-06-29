// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestHasParentFilter(t *testing.T) {
	f := NewHasParentFilter("blog")
	f = f.Query(NewTermQuery("tag", "something"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_parent":{"parent_type":"blog","query":{"term":{"tag":"something"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasParentFilterWithInnerHits(t *testing.T) {
	f := NewHasParentFilter("blog")
	f = f.Query(NewTermQuery("tag", "something"))
	f = f.InnerHit(NewInnerHit())
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_parent":{"inner_hits":{},"parent_type":"blog","query":{"term":{"tag":"something"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasParentFilterWithInnerHitsName(t *testing.T) {
	f := NewHasParentFilter("blog")
	f = f.Query(NewTermQuery("tag", "something"))
	f = f.InnerHit(NewInnerHit().Name("comments"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_parent":{"inner_hits":{"name":"comments"},"parent_type":"blog","query":{"term":{"tag":"something"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasParentFilterWithInnerHitsQuery(t *testing.T) {
	f := NewHasParentFilter("blog")
	f = f.Query(NewTermQuery("tag", "something"))
	f = f.InnerHit(NewInnerHit().Query(NewTermQuery("user", "olivere")))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_parent":{"inner_hits":{"query":{"term":{"user":"olivere"}}},"parent_type":"blog","query":{"term":{"tag":"something"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
