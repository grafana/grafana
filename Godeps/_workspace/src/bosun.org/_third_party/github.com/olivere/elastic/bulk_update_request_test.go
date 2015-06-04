// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestBulkUpdateRequestSerialization(t *testing.T) {
	tests := []struct {
		Request  BulkableRequest
		Expected []string
	}{
		// #0
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("tweet").Id("1").Doc(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_id":"1","_index":"index1","_type":"tweet"}}`,
				`{"doc":{"counter":42}}`,
			},
		},
		// #1
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("tweet").Id("1").
				RetryOnConflict(3).
				DocAsUpsert(true).
				Doc(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_id":"1","_index":"index1","_retry_on_conflict":3,"_type":"tweet"}}`,
				`{"doc":{"counter":42},"doc_as_upsert":true}`,
			},
		},
		// #2
		{
			Request: NewBulkUpdateRequest().Index("index1").Type("tweet").Id("1").
				RetryOnConflict(3).
				Script(`ctx._source.retweets += param1`).
				ScriptLang("js").
				ScriptParams(map[string]interface{}{"param1": 42}).
				Upsert(struct {
				Counter int64 `json:"counter"`
			}{
				Counter: 42,
			}),
			Expected: []string{
				`{"update":{"_id":"1","_index":"index1","_retry_on_conflict":3,"_type":"tweet","upsert":{"counter":42}}}`,
				`{"lang":"js","params":{"param1":42},"script":"ctx._source.retweets += param1"}`,
			},
		},
	}

	for i, test := range tests {
		lines, err := test.Request.Source()
		if err != nil {
			t.Fatalf("case #%d: expected no error, got: %v", i, err)
		}
		if lines == nil {
			t.Fatalf("case #%d: expected lines, got nil", i)
		}
		if len(lines) != len(test.Expected) {
			t.Fatalf("case #%d: expected %d lines, got %d", i, len(test.Expected), len(lines))
		}
		for j, line := range lines {
			if line != test.Expected[j] {
				t.Errorf("case #%d: expected line #%d to be %s, got: %s", i, j, test.Expected[j], line)
			}
		}
	}
}
