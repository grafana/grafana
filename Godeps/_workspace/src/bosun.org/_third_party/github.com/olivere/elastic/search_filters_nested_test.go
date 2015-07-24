// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestNestedFilter(t *testing.T) {
	f := NewNestedFilter("obj1")
	bq := NewBoolQuery()
	bq = bq.Must(NewTermQuery("obj1.name", "blue"))
	bq = bq.Must(NewRangeQuery("obj1.count").Gt(5))
	f = f.Query(bq)
	f = f.Cache(true)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"nested":{"_cache":true,"path":"obj1","query":{"bool":{"must":[{"term":{"obj1.name":"blue"}},{"range":{"obj1.count":{"from":5,"include_lower":false,"include_upper":true,"to":null}}}]}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestNestedFilterWithInnerHit(t *testing.T) {
	f := NewNestedFilter("obj1")
	bq := NewBoolQuery()
	bq = bq.Must(NewTermQuery("obj1.name", "blue"))
	bq = bq.Must(NewRangeQuery("obj1.count").Gt(5))
	f = f.Query(bq)
	f = f.Cache(true)
	f = f.InnerHit(NewInnerHit().Name("comments").Query(NewTermQuery("user", "olivere")))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"nested":{"_cache":true,"inner_hits":{"name":"comments","query":{"term":{"user":"olivere"}}},"path":"obj1","query":{"bool":{"must":[{"term":{"obj1.name":"blue"}},{"range":{"obj1.count":{"from":5,"include_lower":false,"include_upper":true,"to":null}}}]}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
