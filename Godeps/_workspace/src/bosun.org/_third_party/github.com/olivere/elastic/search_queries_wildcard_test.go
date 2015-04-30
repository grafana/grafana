// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic_test

import (
	"encoding/json"
	"testing"

	"bosun.org/_third_party/github.com/olivere/elastic"
)

func ExampleWildcardQuery() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}

	// Define wildcard query
	q := elastic.NewWildcardQuery("user", "oli*er?").Boost(1.2)
	searchResult, err := client.Search().
		Index("twitter"). // search in index "twitter"
		Query(q).         // use wildcard query defined above
		Do()              // execute
	if err != nil {
		// Handle error
		panic(err)
	}
	_ = searchResult
}

func TestWildcardQuery(t *testing.T) {
	q := elastic.NewWildcardQuery("user", "ki*y??")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"wildcard":{"user":{"wildcard":"ki*y??"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestWildcardQueryWithBoost(t *testing.T) {
	q := elastic.NewWildcardQuery("user", "ki*y??").Boost(1.2)
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"wildcard":{"user":{"boost":1.2,"wildcard":"ki*y??"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
