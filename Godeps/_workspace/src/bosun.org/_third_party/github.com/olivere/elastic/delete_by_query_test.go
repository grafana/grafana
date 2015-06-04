// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestDeleteByQuery(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("3").BodyJson(&tweet3).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Count documents
	count, err := client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("expected count = %d; got: %d", 3, count)
	}

	// Delete all documents by sandrae
	q := NewTermQuery("user", "sandrae")
	res, err := client.DeleteByQuery().Index(testIndexName).Type("tweet").Query(q).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatalf("expected response != nil; got: %v", res)
	}
	idx, found := res.Indices[testIndexName]
	if !found {
		t.Errorf("expected Found = true; got: %v", found)
	}
	if idx.Shards.Failed > 0 {
		t.Errorf("expected no failed shards; got: %d", idx.Shards.Failed)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	count, err = client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("expected Count = %d; got: %d", 2, count)
	}
}
