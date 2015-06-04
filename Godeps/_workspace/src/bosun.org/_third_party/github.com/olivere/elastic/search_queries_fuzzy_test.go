// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFuzzyQuery(t *testing.T) {
	q := NewFuzzyQuery().Name("user").Value("ki").Boost(1.5).Fuzziness(2).PrefixLength(0).MaxExpansions(100)
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"fuzzy":{"user":{"boost":1.5,"fuzziness":2,"max_expansions":100,"prefix_length":0,"value":"ki"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
