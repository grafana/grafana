// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/url"
	"testing"
)

func TestClusterHealth(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Get cluster health
	res, err := client.ClusterHealth().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatalf("expected res to be != nil; got: %v", res)
	}
	if res.Status != "green" && res.Status != "red" && res.Status != "yellow" {
		t.Fatalf("expected status \"green\", \"red\", or \"yellow\"; got: %q", res.Status)
	}
}

func TestClusterHealthURLs(t *testing.T) {
	tests := []struct {
		Service        *ClusterHealthService
		ExpectedPath   string
		ExpectedParams url.Values
	}{
		{
			Service: &ClusterHealthService{
				indices: []string{},
			},
			ExpectedPath: "/_cluster/health/",
		},
		{
			Service: &ClusterHealthService{
				indices: []string{"twitter"},
			},
			ExpectedPath: "/_cluster/health/twitter",
		},
		{
			Service: &ClusterHealthService{
				indices: []string{"twitter", "gplus"},
			},
			ExpectedPath: "/_cluster/health/twitter%2Cgplus",
		},
		{
			Service: &ClusterHealthService{
				indices:       []string{"twitter"},
				waitForStatus: "yellow",
			},
			ExpectedPath:   "/_cluster/health/twitter",
			ExpectedParams: url.Values{"wait_for_status": []string{"yellow"}},
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

func TestClusterHealthWaitForStatus(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Cluster health on an index that does not exist should never get to yellow
	health, err := client.ClusterHealth().Index("no-such-index").WaitForStatus("yellow").Timeout("1s").Do()
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if health.TimedOut != true {
		t.Fatalf("expected to timeout; got: %v", health.TimedOut)
	}
	if health.Status != "red" {
		t.Fatalf("expected health = %q; got: %q", "red", health.Status)
	}

	// Cluster wide health
	health, err = client.ClusterHealth().WaitForStatus("green").Timeout("10s").Do()
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
	if health.TimedOut != false {
		t.Fatalf("expected no timeout; got: %v "+
			"(does your local cluster contain unassigned shards?)", health.TimedOut)
	}
	if health.Status != "green" {
		t.Fatalf("expected health = %q; got: %q", "green", health.Status)
	}

	// Cluster wide health via shortcut on client
	err = client.WaitForGreenStatus("10s")
	if err != nil {
		t.Fatalf("expected no error; got: %v", err)
	}
}
