// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestHasChildFilter(t *testing.T) {
	f := NewHasChildFilter("blog_tag")
	f = f.Query(NewTermQuery("tag", "something"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_child":{"query":{"term":{"tag":"something"}},"type":"blog_tag"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasChildFilterWithInnerHits(t *testing.T) {
	f := NewHasChildFilter("blog_tag")
	f = f.Query(NewTermQuery("tag", "something"))
	f = f.InnerHit(NewInnerHit())
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_child":{"inner_hits":{},"query":{"term":{"tag":"something"}},"type":"blog_tag"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasChildFilterWithInnerHitsName(t *testing.T) {
	f := NewHasChildFilter("blog_tag")
	f = f.Query(NewTermQuery("tag", "something"))
	f = f.InnerHit(NewInnerHit().Name("comments"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_child":{"inner_hits":{"name":"comments"},"query":{"term":{"tag":"something"}},"type":"blog_tag"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHasChildFilterWithInnerHitsQuery(t *testing.T) {
	f := NewHasChildFilter("blog_tag")
	f = f.Query(NewTermQuery("tag", "something"))
	hit := NewInnerHit().Query(NewTermQuery("user", "olivere"))
	f = f.InnerHit(hit)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"has_child":{"inner_hits":{"query":{"term":{"user":"olivere"}}},"query":{"term":{"tag":"something"}},"type":"blog_tag"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
