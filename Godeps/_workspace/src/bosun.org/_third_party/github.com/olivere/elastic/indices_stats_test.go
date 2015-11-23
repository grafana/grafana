// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestIndexStatsBuildURL(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tests := []struct {
		Indices  []string
		Metrics  []string
		Expected string
	}{
		{
			[]string{},
			[]string{},
			"/_stats",
		},
		{
			[]string{"index1"},
			[]string{},
			"/index1/_stats",
		},
		{
			[]string{},
			[]string{"metric1"},
			"/_stats/metric1",
		},
		{
			[]string{"index1"},
			[]string{"metric1"},
			"/index1/_stats/metric1",
		},
		{
			[]string{"index1", "index2"},
			[]string{"metric1"},
			"/index1%2Cindex2/_stats/metric1",
		},
		{
			[]string{"index1", "index2"},
			[]string{"metric1", "metric2"},
			"/index1%2Cindex2/_stats/metric1%2Cmetric2",
		},
	}

	for i, test := range tests {
		path, _, err := client.IndexStats().Index(test.Indices...).Metric(test.Metrics...).buildURL()
		if err != nil {
			t.Fatalf("case #%d: %v", i+1, err)
		}
		if path != test.Expected {
			t.Errorf("case #%d: expected %q; got: %q", i+1, test.Expected, path)
		}
	}
}

func TestIndexStats(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	stats, err := client.IndexStats(testIndexName).Do()
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if stats == nil {
		t.Fatalf("expected response; got: %v", stats)
	}
	stat, found := stats.Indices[testIndexName]
	if !found {
		t.Fatalf("expected stats about index %q; got: %v", testIndexName, found)
	}
	if stat.Total == nil {
		t.Fatalf("expected total to be != nil; got: %v", stat.Total)
	}
	if stat.Total.Docs == nil {
		t.Fatalf("expected total docs to be != nil; got: %v", stat.Total.Docs)
	}
	if stat.Total.Docs.Count == 0 {
		t.Fatalf("expected total docs count to be > 0; got: %d", stat.Total.Docs.Count)
	}
}
