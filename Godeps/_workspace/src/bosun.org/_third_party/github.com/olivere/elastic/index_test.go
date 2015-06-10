// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

const (
	testIndexName  = "elastic-test"
	testIndexName2 = "elastic-test2"
	testMapping    = `
{
	"settings":{
		"number_of_shards":1,
		"number_of_replicas":0
	},
	"mappings":{
		"tweet":{
			"properties":{
				"tags":{
					"type":"string"
				},
				"location":{
					"type":"geo_point"
				},
				"suggest_field":{
					"type":"completion",
					"payloads":true
				}
			}
		}
	}
}
`
)

type tweet struct {
	User     string        `json:"user"`
	Message  string        `json:"message"`
	Retweets int           `json:"retweets"`
	Image    string        `json:"image,omitempty"`
	Created  time.Time     `json:"created,omitempty"`
	Tags     []string      `json:"tags,omitempty"`
	Location string        `json:"location,omitempty"`
	Suggest  *SuggestField `json:"suggest_field,omitempty"`
}

func isTravis() bool {
	return os.Getenv("TRAVIS") != ""
}

func travisGoVersion() string {
	return os.Getenv("TRAVIS_GO_VERSION")
}

type logger interface {
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
	Fatal(args ...interface{})
	Fatalf(format string, args ...interface{})
	Fail()
	FailNow()
	Log(args ...interface{})
	Logf(format string, args ...interface{})
}

func setupTestClient(t logger, options ...ClientOptionFunc) (client *Client) {
	var err error

	client, err = NewClient(options...)
	if err != nil {
		t.Fatal(err)
	}

	client.DeleteIndex(testIndexName).Do()
	client.DeleteIndex(testIndexName2).Do()

	return client
}

func setupTestClientAndCreateIndex(t logger, options ...ClientOptionFunc) *Client {
	client := setupTestClient(t, options...)

	// Create index
	createIndex, err := client.CreateIndex(testIndexName).Body(testMapping).Do()
	if err != nil {
		t.Fatal(err)
	}
	if createIndex == nil {
		t.Errorf("expected result to be != nil; got: %v", createIndex)
	}

	// Create second index
	createIndex2, err := client.CreateIndex(testIndexName2).Body(testMapping).Do()
	if err != nil {
		t.Fatal(err)
	}
	if createIndex2 == nil {
		t.Errorf("expected result to be != nil; got: %v", createIndex2)
	}

	return client
}

func TestIndexLifecycle(t *testing.T) {
	client := setupTestClient(t)

	// Create index
	createIndex, err := client.CreateIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !createIndex.Acknowledged {
		t.Errorf("expected CreateIndexResult.Acknowledged %v; got %v", true, createIndex.Acknowledged)
	}

	// Check if index exists
	indexExists, err := client.IndexExists(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !indexExists {
		t.Fatalf("index %s should exist, but doesn't\n", testIndexName)
	}

	// Delete index
	deleteIndex, err := client.DeleteIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !deleteIndex.Acknowledged {
		t.Errorf("expected DeleteIndexResult.Acknowledged %v; got %v", true, deleteIndex.Acknowledged)
	}

	// Check if index exists
	indexExists, err = client.IndexExists(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if indexExists {
		t.Fatalf("index %s should not exist, but does\n", testIndexName)
	}
}

func TestIndexExistScenarios(t *testing.T) {
	client := setupTestClient(t)

	// Should return false if index does not exist
	indexExists, err := client.IndexExists(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if indexExists {
		t.Fatalf("expected index exists to return %v, got %v", false, indexExists)
	}

	// Create index
	createIndex, err := client.CreateIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !createIndex.Acknowledged {
		t.Errorf("expected CreateIndexResult.Ack %v; got %v", true, createIndex.Acknowledged)
	}

	// Should return true if index does not exist
	indexExists, err = client.IndexExists(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !indexExists {
		t.Fatalf("expected index exists to return %v, got %v", true, indexExists)
	}
}

// TODO(oe): Find out why this test fails on Travis CI.
/*
func TestIndexOpenAndClose(t *testing.T) {
	client := setupTestClient(t)

	// Create index
	createIndex, err := client.CreateIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !createIndex.Acknowledged {
		t.Errorf("expected CreateIndexResult.Acknowledged %v; got %v", true, createIndex.Acknowledged)
	}
	defer func() {
		// Delete index
		deleteIndex, err := client.DeleteIndex(testIndexName).Do()
		if err != nil {
			t.Fatal(err)
		}
		if !deleteIndex.Acknowledged {
			t.Errorf("expected DeleteIndexResult.Acknowledged %v; got %v", true, deleteIndex.Acknowledged)
		}
	}()

	waitForYellow := func() {
		// Wait for status yellow
		res, err := client.ClusterHealth().WaitForStatus("yellow").Timeout("15s").Do()
		if err != nil {
			t.Fatal(err)
		}
		if res != nil && res.TimedOut {
			t.Fatalf("cluster time out waiting for status %q", "yellow")
		}
	}

	// Wait for cluster
	waitForYellow()

	// Close index
	cresp, err := client.CloseIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !cresp.Acknowledged {
		t.Fatalf("expected close index of %q to be acknowledged\n", testIndexName)
	}

	// Wait for cluster
	waitForYellow()

	// Open index again
	oresp, err := client.OpenIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !oresp.Acknowledged {
		t.Fatalf("expected open index of %q to be acknowledged\n", testIndexName)
	}
}
*/

func TestDocumentLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	// Add a document
	indexResult, err := client.Index().
		Index(testIndexName).
		Type("tweet").
		Id("1").
		BodyJson(&tweet1).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if indexResult == nil {
		t.Errorf("expected result to be != nil; got: %v", indexResult)
	}

	// Exists
	exists, err := client.Exists().Index(testIndexName).Type("tweet").Id("1").Do()
	if err != nil {
		t.Fatal(err)
	}
	if !exists {
		t.Errorf("expected exists %v; got %v", true, exists)
	}

	// Get document
	getResult, err := client.Get().
		Index(testIndexName).
		Type("tweet").
		Id("1").
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if getResult.Index != testIndexName {
		t.Errorf("expected GetResult.Index %q; got %q", testIndexName, getResult.Index)
	}
	if getResult.Type != "tweet" {
		t.Errorf("expected GetResult.Type %q; got %q", "tweet", getResult.Type)
	}
	if getResult.Id != "1" {
		t.Errorf("expected GetResult.Id %q; got %q", "1", getResult.Id)
	}
	if getResult.Source == nil {
		t.Errorf("expected GetResult.Source to be != nil; got nil")
	}

	// Decode the Source field
	var tweetGot tweet
	err = json.Unmarshal(*getResult.Source, &tweetGot)
	if err != nil {
		t.Fatal(err)
	}
	if tweetGot.User != tweet1.User {
		t.Errorf("expected Tweet.User to be %q; got %q", tweet1.User, tweetGot.User)
	}
	if tweetGot.Message != tweet1.Message {
		t.Errorf("expected Tweet.Message to be %q; got %q", tweet1.Message, tweetGot.Message)
	}

	// Delete document again
	deleteResult, err := client.Delete().Index(testIndexName).Type("tweet").Id("1").Do()
	if err != nil {
		t.Fatal(err)
	}
	if deleteResult == nil {
		t.Errorf("expected result to be != nil; got: %v", deleteResult)
	}

	// Exists
	exists, err = client.Exists().Index(testIndexName).Type("tweet").Id("1").Do()
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Errorf("expected exists %v; got %v", false, exists)
	}
}

func TestDocumentLifecycleWithAutomaticIDGeneration(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}

	// Add a document
	indexResult, err := client.Index().
		Index(testIndexName).
		Type("tweet").
		BodyJson(&tweet1).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if indexResult == nil {
		t.Errorf("expected result to be != nil; got: %v", indexResult)
	}
	if indexResult.Id == "" {
		t.Fatalf("expected Es to generate an automatic ID, got: %v", indexResult.Id)
	}
	id := indexResult.Id

	// Exists
	exists, err := client.Exists().Index(testIndexName).Type("tweet").Id(id).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !exists {
		t.Errorf("expected exists %v; got %v", true, exists)
	}

	// Get document
	getResult, err := client.Get().
		Index(testIndexName).
		Type("tweet").
		Id(id).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if getResult.Index != testIndexName {
		t.Errorf("expected GetResult.Index %q; got %q", testIndexName, getResult.Index)
	}
	if getResult.Type != "tweet" {
		t.Errorf("expected GetResult.Type %q; got %q", "tweet", getResult.Type)
	}
	if getResult.Id != id {
		t.Errorf("expected GetResult.Id %q; got %q", id, getResult.Id)
	}
	if getResult.Source == nil {
		t.Errorf("expected GetResult.Source to be != nil; got nil")
	}

	// Decode the Source field
	var tweetGot tweet
	err = json.Unmarshal(*getResult.Source, &tweetGot)
	if err != nil {
		t.Fatal(err)
	}
	if tweetGot.User != tweet1.User {
		t.Errorf("expected Tweet.User to be %q; got %q", tweet1.User, tweetGot.User)
	}
	if tweetGot.Message != tweet1.Message {
		t.Errorf("expected Tweet.Message to be %q; got %q", tweet1.Message, tweetGot.Message)
	}

	// Delete document again
	deleteResult, err := client.Delete().Index(testIndexName).Type("tweet").Id(id).Do()
	if err != nil {
		t.Fatal(err)
	}
	if deleteResult == nil {
		t.Errorf("expected result to be != nil; got: %v", deleteResult)
	}

	// Exists
	exists, err = client.Exists().Index(testIndexName).Type("tweet").Id(id).Do()
	if err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Errorf("expected exists %v; got %v", false, exists)
	}
}

func TestIndexCreateExistsOpenCloseDelete(t *testing.T) {
	// TODO: Find out how to make these test robust
	t.Skip("test fails regularly with 409 (Conflict): " +
		"IndexPrimaryShardNotAllocatedException[[elastic-test] " +
		"primary not allocated post api... skipping")

	client := setupTestClient(t)

	// Create index
	createIndex, err := client.CreateIndex(testIndexName).Body(testMapping).Do()
	if err != nil {
		t.Fatal(err)
	}
	if createIndex == nil {
		t.Fatalf("expected response; got: %v", createIndex)
	}
	if !createIndex.Acknowledged {
		t.Errorf("expected ack for creating index; got: %v", createIndex.Acknowledged)
	}

	// Exists
	indexExists, err := client.IndexExists(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if !indexExists {
		t.Fatalf("expected index exists=%v; got %v", true, indexExists)
	}

	// Flush
	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Close index
	closeIndex, err := client.CloseIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if closeIndex == nil {
		t.Fatalf("expected response; got: %v", closeIndex)
	}
	if !closeIndex.Acknowledged {
		t.Errorf("expected ack for closing index; got: %v", closeIndex.Acknowledged)
	}

	// Open index
	openIndex, err := client.OpenIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if openIndex == nil {
		t.Fatalf("expected response; got: %v", openIndex)
	}
	if !openIndex.Acknowledged {
		t.Errorf("expected ack for opening index; got: %v", openIndex.Acknowledged)
	}

	// Flush
	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Delete index
	deleteIndex, err := client.DeleteIndex(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	if deleteIndex == nil {
		t.Fatalf("expected response; got: %v", deleteIndex)
	}
	if !deleteIndex.Acknowledged {
		t.Errorf("expected ack for deleting index; got %v", deleteIndex.Acknowledged)
	}
}
