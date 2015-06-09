// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestRegexpQuery(t *testing.T) {
	q := NewRegexpQuery("name.first", "s.*y")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"regexp":{"name.first":{"value":"s.*y"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestRegexpQueryWithOptions(t *testing.T) {
	q := NewRegexpQuery("name.first", "s.*y").
		Boost(1.2).
		Flags("INTERSECTION|COMPLEMENT|EMPTY").
		QueryName("my_query_name")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"regexp":{"name.first":{"boost":1.2,"flags":"INTERSECTION|COMPLEMENT|EMPTY","name":"my_query_name","value":"s.*y"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
