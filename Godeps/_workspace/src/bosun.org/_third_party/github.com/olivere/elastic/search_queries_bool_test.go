// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestBoolQuery(t *testing.T) {
	q := NewBoolQuery()
	q = q.Must(NewTermQuery("tag", "wow"))
	q = q.MustNot(NewRangeQuery("age").From(10).To(20))
	q = q.Should(NewTermQuery("tag", "sometag"), NewTermQuery("tag", "sometagtag"))
	q = q.Boost(10)
	q = q.DisableCoord(true)
	q = q.QueryName("Test")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"bool":{"_name":"Test","boost":10,"disable_coord":true,"must":{"term":{"tag":"wow"}},"must_not":{"range":{"age":{"from":10,"include_lower":true,"include_upper":true,"to":20}}},"should":[{"term":{"tag":"sometag"}},{"term":{"tag":"sometagtag"}}]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
