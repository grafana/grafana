// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestTopHitsAggregation(t *testing.T) {
	fsc := NewFetchSourceContext(true).Include("title")
	agg := NewTopHitsAggregation().
		Sort("last_activity_date", false).
		FetchSourceContext(fsc).
		Size(1)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"top_hits":{"_source":{"excludes":[],"includes":["title"]},"size":1,"sort":[{"last_activity_date":{"order":"desc"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
