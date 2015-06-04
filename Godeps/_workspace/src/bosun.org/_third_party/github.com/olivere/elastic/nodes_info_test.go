// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestNodesInfo(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}

	info, err := client.NodesInfo().Do()
	if err != nil {
		t.Fatal(err)
	}
	if info == nil {
		t.Fatal("expected nodes info")
	}

	if info.ClusterName == "" {
		t.Errorf("expected cluster name; got: %q", info.ClusterName)
	}
	if len(info.Nodes) == 0 {
		t.Errorf("expected some nodes; got: %d", len(info.Nodes))
	}
	for id, node := range info.Nodes {
		if id == "" {
			t.Errorf("expected node id; got: %q", id)
		}
		if node == nil {
			t.Fatalf("expected node info; got: %v", node)
		}
		if node.IP == "" {
			t.Errorf("expected node IP; got: %q", node.IP)
		}
	}
}
