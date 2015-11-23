// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

func TestExplain(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	// Add a document
	indexResult, err := client.Index().
		Index(testIndexName).
		Type("tweet").
		Id("1").
		BodyJson(&tweet1).
		Refresh(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if indexResult == nil {
		t.Errorf("expected result to be != nil; got: %v", indexResult)
	}

	// Explain
	query := NewTermQuery("user", "olivere")
	expl, err := client.Explain(testIndexName, "tweet", "1").Query(query).Do()
	if err != nil {
		t.Fatal(err)
	}
	if expl == nil {
		t.Fatal("expected to return an explanation")
	}
	if !expl.Matched {
		t.Errorf("expected matched to be %v; got: %v", true, expl.Matched)
	}
}
