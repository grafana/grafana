// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestBoolFilter(t *testing.T) {
	f := NewBoolFilter()
	f = f.Must(NewTermFilter("tag", "wow"))
	f = f.MustNot(NewRangeFilter("age").From(10).To(20))
	f = f.Should(NewTermFilter("tag", "sometag"), NewTermFilter("tag", "sometagtag"))
	f = f.Cache(true)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"bool":{"_cache":true,"must":{"term":{"tag":"wow"}},"must_not":{"range":{"age":{"from":10,"include_lower":true,"include_upper":true,"to":20}}},"should":[{"term":{"tag":"sometag"}},{"term":{"tag":"sometagtag"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
