// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestIdsQuery(t *testing.T) {
	q := NewIdsQuery("my_type").Ids("1", "4", "100").Boost(10.5).QueryName("my_query")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"ids":{"_name":"my_query","boost":10.5,"type":"my_type","values":["1","4","100"]}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
