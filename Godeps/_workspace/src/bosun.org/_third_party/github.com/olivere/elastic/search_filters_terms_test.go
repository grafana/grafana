// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTermsFilter(t *testing.T) {
	f := NewTermsFilter("user", "kimchy", "elasticsearch")
	f = f.Cache(true)
	f = f.CacheKey("MyTermsFilter")
	f = f.FilterName("MyFilterName")
	f = f.Execution("plain")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"terms":{"_cache":true,"_cache_key":"MyTermsFilter","_name":"MyFilterName","execution":"plain","user":["kimchy","elasticsearch"]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
