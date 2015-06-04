// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestPrefixQuery(t *testing.T) {
	q := NewPrefixQuery("user", "ki")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"prefix":{"user":"ki"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestPrefixQueryWithOptions(t *testing.T) {
	q := NewPrefixQuery("user", "ki")
	q = q.QueryName("my_query_name")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"prefix":{"user":{"_name":"my_query_name","prefix":"ki"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
