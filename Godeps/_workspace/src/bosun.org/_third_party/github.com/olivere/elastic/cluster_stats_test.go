// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/url"
	"testing"
)

func TestClusterStats(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Get cluster stats
	res, err := client.ClusterStats().Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatalf("expected res to be != nil; got: %v", res)
	}
	if res.ClusterName == "" {
		t.Fatalf("expected a cluster name; got: %q", res.ClusterName)
	}
}

func TestClusterStatsURLs(t *testing.T) {
	fFlag := false
	tFlag := true

	tests := []struct {
		Service        *ClusterStatsService
		ExpectedPath   string
		ExpectedParams url.Values
	}{
		{
			Service: &ClusterStatsService{
				nodeId: []string{},
			},
			ExpectedPath: "/_cluster/stats",
		},
		{
			Service: &ClusterStatsService{
				nodeId: []string{"node1"},
			},
			ExpectedPath: "/_cluster/stats/nodes/node1",
		},
		{
			Service: &ClusterStatsService{
				nodeId: []string{"node1", "node2"},
			},
			ExpectedPath: "/_cluster/stats/nodes/node1%2Cnode2",
		},
		{
			Service: &ClusterStatsService{
				nodeId:       []string{},
				flatSettings: &tFlag,
			},
			ExpectedPath:   "/_cluster/stats",
			ExpectedParams: url.Values{"flat_settings": []string{"true"}},
		},
		{
			Service: &ClusterStatsService{
				nodeId:       []string{"node1"},
				flatSettings: &fFlag,
			},
			ExpectedPath:   "/_cluster/stats/nodes/node1",
			ExpectedParams: url.Values{"flat_settings": []string{"false"}},
		},
	}

	for _, test := range tests {
		gotPath, gotParams, err := test.Service.buildURL()
		if err != nil {
			t.Fatalf("expected no error; got: %v", err)
		}
		if gotPath != test.ExpectedPath {
			t.Errorf("expected URL path = %q; got: %q", test.ExpectedPath, gotPath)
		}
		if gotParams.Encode() != test.ExpectedParams.Encode() {
			t.Errorf("expected URL params = %v; got: %v", test.ExpectedParams, gotParams)
		}
	}
}
