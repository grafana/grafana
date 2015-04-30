// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	_ "net/http"
	"testing"
)

func TestClearScroll(t *testing.T) {
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

	// Match all should return all documents
	res, err := client.Scroll(testIndexName).Size(1).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Errorf("expected results != nil; got nil")
	}
	if res.ScrollId == "" {
		t.Errorf("expected scrollId in results; got %q", res.ScrollId)
	}

	// Search should succeed
	_, err = client.Scroll(testIndexName).Size(1).ScrollId(res.ScrollId).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Clear scroll id
	clearScrollRes, err := client.ClearScroll().ScrollId(res.ScrollId).Do()
	if err != nil {
		t.Fatal(err)
	}
	if clearScrollRes == nil {
		t.Error("expected results != nil; got nil")
	}

	// Search result should fail
	_, err = client.Scroll(testIndexName).Size(1).ScrollId(res.ScrollId).Do()
	if err == nil {
		t.Fatalf("expected scroll to fail")
	}
}
