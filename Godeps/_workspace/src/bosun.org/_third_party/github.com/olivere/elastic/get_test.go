// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestGet(t *testing.T) {
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
		t.Errorf("expected Count = %d; got %d", 3, count)
	}

	// Get document 1
	res, err := client.Get().Index(testIndexName).Type("tweet").Id("1").Do()
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != true {
		t.Errorf("expected Found = true; got %v", res.Found)
	}
	if res.Source == nil {
		t.Errorf("expected Source != nil; got %v", res.Source)
	}

	// Get non existent document 99
	res, err = client.Get().Index(testIndexName).Type("tweet").Id("99").Do()
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != false {
		t.Errorf("expected Found = false; got %v", res.Found)
	}
	if res.Source != nil {
		t.Errorf("expected Source == nil; got %v", res.Source)
	}
}

func TestGetWithSourceFiltering(t *testing.T) {
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

	// Get document 1, without source
	res, err := client.Get().Index(testIndexName).Type("tweet").Id("1").FetchSource(false).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != true {
		t.Errorf("expected Found = true; got %v", res.Found)
	}
	if res.Source != nil {
		t.Errorf("expected Source == nil; got %v", res.Source)
	}

	// Get document 1, exclude Message field
	fsc := NewFetchSourceContext(true).Exclude("message")
	res, err = client.Get().Index(testIndexName).Type("tweet").Id("1").FetchSourceContext(fsc).Do()
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != true {
		t.Errorf("expected Found = true; got %v", res.Found)
	}
	if res.Source == nil {
		t.Errorf("expected Source != nil; got %v", res.Source)
	}
	var tw tweet
	err = json.Unmarshal(*res.Source, &tw)
	if err != nil {
		t.Fatal(err)
	}
	if tw.User != "olivere" {
		t.Errorf("expected user %q; got: %q", "olivere", tw.User)
	}
	if tw.Message != "" {
		t.Errorf("expected message %q; got: %q", "", tw.Message)
	}
}
