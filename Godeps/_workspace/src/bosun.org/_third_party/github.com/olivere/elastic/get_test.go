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
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
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
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
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

func TestGetWithFields(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").Timestamp("12345").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Get document 1, specifying fields
	res, err := client.Get().Index(testIndexName).Type("tweet").Id("1").Fields("message", "_timestamp").Do()
	if err != nil {
		t.Fatal(err)
	}
	if res.Found != true {
		t.Errorf("expected Found = true; got %v", res.Found)
	}

	timestamp, ok := res.Fields["_timestamp"].(float64)
	if !ok {
		t.Fatalf("Cannot retrieve \"_timestamp\" field from document")
	}
	if timestamp != 12345 {
		t.Fatalf("Expected timestamp %v; got %v", 12345, timestamp)
	}

	messageField, ok := res.Fields["message"]
	if !ok {
		t.Fatalf("Cannot retrieve \"message\" field from document")
	}

	// Depending on the version of elasticsearch the message field will be returned
	// as a string or a slice of strings. This test works in both cases.

	messageString, ok := messageField.(string)
	if !ok {
		messageArray, ok := messageField.([]interface{})
		if ok {
			messageString, ok = messageArray[0].(string)
		}
		if !ok {
			t.Fatalf("\"message\" field should be a string or a slice of strings")
		}
	}

	if messageString != tweet1.Message {
		t.Errorf("Expected message %s; got %s", tweet1.Message, messageString)
	}
}

func TestGetFailsWithMissingParams(t *testing.T) {
	// Mitigate against http://stackoverflow.com/questions/27491738/elasticsearch-go-index-failures-no-feature-for-name
	client := setupTestClientAndCreateIndex(t)
	if _, err := client.Get().Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
	if _, err := client.Get().Index(testIndexName).Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
	if _, err := client.Get().Type("tweet").Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
	if _, err := client.Get().Id("1").Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
	if _, err := client.Get().Index(testIndexName).Type("tweet").Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
	/*
		if _, err := client.Get().Index(testIndexName).Id("1").Do(); err == nil {
			t.Fatal("expected Get to fail")
		}
	*/
	if _, err := client.Get().Type("tweet").Id("1").Do(); err == nil {
		t.Fatal("expected Get to fail")
	}
}
