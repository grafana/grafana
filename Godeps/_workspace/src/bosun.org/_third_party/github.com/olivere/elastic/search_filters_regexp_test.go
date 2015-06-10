// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestRegexpFilter(t *testing.T) {
	f := NewRegexpFilter("name.first", "s.*y")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"regexp":{"name.first":"s.*y"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRegexpFilterWithFlags(t *testing.T) {
	f := NewRegexpFilter("name.first", "s.*y")
	f = f.Flags("INTERSECTION|COMPLEMENT|EMPTY")
	f = f.FilterName("test").Cache(true).CacheKey("key")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"regexp":{"_cache":true,"_cache_key":"key","_name":"test","name.first":{"flags":"INTERSECTION|COMPLEMENT|EMPTY","value":"s.*y"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
