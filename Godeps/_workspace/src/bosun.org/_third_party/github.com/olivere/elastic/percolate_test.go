// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestPercolate(t *testing.T) {
	client := setupTestClientAndCreateIndex(t) //, SetTraceLog(log.New(os.Stdout, "", 0)))

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	// Add a document
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Register a query in the ".percolator" type.
	search := NewSearchSource().Query(NewMatchQuery("message", "Golang"))
	_, err = client.Index().
		Index(testIndexName).Type(".percolator").Id("1").
		BodyJson(search.Source()).
		Do()
	if err != nil {
		t.Fatal(err)
	}

	// Percolate should return our registered query
	newTweet := tweet{User: "olivere", Message: "Golang is fun."}
	res, err := client.Percolate().
		Index(testIndexName).Type("tweet").
		Doc(newTweet). // shortcut for: BodyJson(map[string]interface{}{"doc": newTweet}).
		Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Errorf("expected results != nil; got nil")
	}
	if res.Total != 1 {
		t.Fatalf("expected 1 result; got: %d", res.Total)
	}
	if res.Matches == nil {
		t.Fatalf("expected Matches; got: %v", res.Matches)
	}
	matches := res.Matches
	if matches == nil {
		t.Fatalf("expected matches as map; got: %v", matches)
	}
	if len(matches) != 1 {
		t.Fatalf("expected %d registered matches; got: %d", 1, len(matches))
	}
	if matches[0].Id != "1" {
		t.Errorf("expected to return query %q; got: %q", "1", matches[0].Id)
	}
}
