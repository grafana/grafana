// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFuzzyLikeThisFieldQuery(t *testing.T) {
	q := NewFuzzyLikeThisFieldQuery("name.first").LikeText("text like this one").MaxQueryTerms(12)
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"fuzzy_like_this_field":{"name.first":{"like_text":"text like this one","max_query_terms":12}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
