// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestOrFilter(t *testing.T) {
	f := NewOrFilter()
	postDateFilter := NewRangeFilter("postDate").From("2010-03-01").To("2010-04-01")
	f = f.Add(postDateFilter)
	prefixFilter := NewPrefixFilter("name.second", "ba")
	f = f.Add(prefixFilter)
	f = f.Cache(true)
	f = f.CacheKey("MyOrFilter")
	f = f.FilterName("MyFilterName")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"or":{"_cache":true,"_cache_key":"MyOrFilter","_name":"MyFilterName","filters":[{"range":{"postDate":{"from":"2010-03-01","include_lower":true,"include_upper":true,"to":"2010-04-01"}}},{"prefix":{"name.second":"ba"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestNewOrFilter(t *testing.T) {
	tf := NewTermsFilter("user", "oliver", "test")
	mf := NewMissingFilter("user")
	f := NewOrFilter(tf, mf)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"or":{"filters":[{"terms":{"user":["oliver","test"]}},{"missing":{"field":"user"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
