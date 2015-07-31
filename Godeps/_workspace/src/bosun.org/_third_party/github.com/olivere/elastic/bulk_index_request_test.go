// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
	"time"
)

func TestBulkIndexRequestSerialization(t *testing.T) {
	tests := []struct {
		Request  BulkableRequest
		Expected []string
	}{
		// #0
		{
			Request: NewBulkIndexRequest().Index("index1").Type("tweet").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_id":"1","_index":"index1","_type":"tweet"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #1
		{
			Request: NewBulkIndexRequest().OpType("create").Index("index1").Type("tweet").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"create":{"_id":"1","_index":"index1","_type":"tweet"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
			},
		},
		// #2
		{
			Request: NewBulkIndexRequest().OpType("index").Index("index1").Type("tweet").Id("1").
				Doc(tweet{User: "olivere", Created: time.Date(2014, 1, 18, 23, 59, 58, 0, time.UTC)}),
			Expected: []string{
				`{"index":{"_id":"1","_index":"index1","_type":"tweet"}}`,
				`{"user":"olivere","message":"","retweets":0,"created":"2014-01-18T23:59:58Z"}`,
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
