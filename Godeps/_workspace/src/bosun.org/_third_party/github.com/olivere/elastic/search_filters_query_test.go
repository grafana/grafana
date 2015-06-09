// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestQueryFilter(t *testing.T) {
	f := NewQueryFilter(NewQueryStringQuery("this AND that OR thus"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"query":{"query_string":{"query":"this AND that OR thus"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestQueryFilterWithName(t *testing.T) {
	f := NewQueryFilter(NewQueryStringQuery("this AND that OR thus"))
	f = f.Cache(true)
	f = f.FilterName("MyFilterName")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"fquery":{"_cache":true,"_name":"MyFilterName","query":{"query_string":{"query":"this AND that OR thus"}}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
