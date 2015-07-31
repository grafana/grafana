// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestHasChildQuery(t *testing.T) {
	f := NewHasChildQuery("blog_tag", NewTermQuery("tag", "something"))
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

func TestHasChildQueryWithInnerHit(t *testing.T) {
	f := NewHasChildQuery("blog_tag", NewTermQuery("tag", "something"))
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
