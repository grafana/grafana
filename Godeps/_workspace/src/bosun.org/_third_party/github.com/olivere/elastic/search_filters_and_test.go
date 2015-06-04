// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestAndFilter(t *testing.T) {
	f := NewAndFilter()
	postDateFilter := NewRangeFilter("postDate").From("2010-03-01").To("2010-04-01")
	f = f.Add(postDateFilter)
	prefixFilter := NewPrefixFilter("name.second", "ba")
	f = f.Add(prefixFilter)
	f = f.Cache(true)
	f = f.CacheKey("MyAndFilter")
	f = f.FilterName("MyFilterName")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"and":{"_cache":true,"_cache_key":"MyAndFilter","_name":"MyFilterName","filters":[{"range":{"postDate":{"from":"2010-03-01","include_lower":true,"include_upper":true,"to":"2010-04-01"}}},{"prefix":{"name.second":"ba"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestNewAndFilter1(t *testing.T) {
	f := NewAndFilter(NewTermFilter("user", "olivere"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"and":{"filters":[{"term":{"user":"olivere"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestNewAndFilter2(t *testing.T) {
	tf := NewTermsFilter("user", "oliver", "test")
	mf := NewMissingFilter("user")
	f := NewAndFilter(tf, mf)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"and":{"filters":[{"terms":{"user":["oliver","test"]}},{"missing":{"field":"user"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
