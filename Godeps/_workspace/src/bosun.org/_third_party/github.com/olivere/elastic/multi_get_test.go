// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestMultiGet(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add some documents
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
		t.Errorf("expected Count = %d; got %d", 3, count)
	}

	// Get documents 1 and 3
	res, err := client.MultiGet().
		Add(NewMultiGetItem().Index(testIndexName).Type("tweet").Id("1")).
		Add(NewMultiGetItem().Index(testIndexName).Type("tweet").Id("3")).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if res == nil {
		t.Fatal("expected result to be != nil; got nil")
	}
	if res.Docs == nil {
		t.Fatal("expected result docs to be != nil; got nil")
	}
	if len(res.Docs) != 2 {
		t.Fatalf("expected to have 2 docs; got %d", len(res.Docs))
	}

	item := res.Docs[0]
	if item.Error != "" {
		t.Errorf("expected no error on item 0; got %q", item.Error)
	}
	if item.Source == nil {
		t.Errorf("expected Source != nil; got %v", item.Source)
	}
	var doc tweet
	if err := json.Unmarshal(*item.Source, &doc); err != nil {
		t.Fatalf("expected to unmarshal item Source; got %v", err)
	}
	if doc.Message != tweet1.Message {
		t.Errorf("expected Message of first tweet to be %q; got %q", tweet1.Message, doc.Message)
	}

	item = res.Docs[1]
	if item.Error != "" {
		t.Errorf("expected no error on item 1; got %q", item.Error)
	}
	if item.Source == nil {
		t.Errorf("expected Source != nil; got %v", item.Source)
	}
	if err := json.Unmarshal(*item.Source, &doc); err != nil {
		t.Fatalf("expected to unmarshal item Source; got %v", err)
	}
	if doc.Message != tweet3.Message {
		t.Errorf("expected Message of second tweet to be %q; got %q", tweet3.Message, doc.Message)
	}
}
