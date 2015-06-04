// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	_ "encoding/json"
	_ "net/http"
	"testing"
)

func TestTermSuggester(t *testing.T) {
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
	all := NewMatchAllQuery()

	tsName := "my-suggestions"
	ts := NewTermSuggester(tsName)
	ts = ts.Text("Goolang")
	ts = ts.Field("message")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Suggester(ts).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[tsName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", tsName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", tsName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "goolang" {
		t.Errorf("expected Text = 'goolang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 7 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
	if len(mySuggestion.Options) != 1 {
		t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
	}
	myOption := mySuggestion.Options[0]
	if myOption.Text != "golang" {
		t.Errorf("expected Text = 'golang'; got %s", myOption.Text)
	}
	if myOption.Score == float32(0.0) {
		t.Errorf("expected Score != 0.0; got %v", myOption.Score)
	}
	if myOption.Freq == 0 {
		t.Errorf("expected Freq != 0; got %v", myOption.Freq)
	}
}

func TestPhraseSuggester(t *testing.T) {
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
	all := NewMatchAllQuery()

	phraseSuggesterName := "my-suggestions"
	ps := NewPhraseSuggester(phraseSuggesterName)
	ps = ps.Text("Goolang")
	ps = ps.Field("message")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Suggester(ps).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[phraseSuggesterName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false", phraseSuggesterName)
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", phraseSuggesterName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "Goolang" {
		t.Errorf("expected Text = 'Goolang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 7 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
	/*
		if len(mySuggestion.Options) != 1 {
			t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
		}
			myOption := mySuggestion.Options[0]
			if myOption.Text != "golang" {
				t.Errorf("expected Text = 'golang'; got %s", myOption.Text)
			}
			if myOption.Score == float32(0.0) {
				t.Errorf("expected Score != 0.0; got %v", myOption.Score)
			}
	*/
}

// TODO(oe): I get a "Completion suggester not supported" exception on 0.90.2?!
/*
func TestCompletionSuggester(t *testing.T) {
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
	all := NewMatchAllQuery()

	suggesterName := "my-suggestions"
	cs := NewCompletionSuggester(suggesterName)
	cs = cs.Text("Goolang")
	cs = cs.Field("message")

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Suggester(cs).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Suggest == nil {
		t.Errorf("expected SearchResult.Suggest != nil; got nil")
	}
	mySuggestions, found := searchResult.Suggest[suggesterName]
	if !found {
		t.Errorf("expected to find SearchResult.Suggest[%s]; got false")
	}
	if mySuggestions == nil {
		t.Errorf("expected SearchResult.Suggest[%s] != nil; got nil", suggesterName)
	}

	if len(mySuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(mySuggestions))
	}
	mySuggestion := mySuggestions[0]
	if mySuggestion.Text != "Goolang" {
		t.Errorf("expected Text = 'Goolang'; got %s", mySuggestion.Text)
	}
	if mySuggestion.Offset != 0 {
		t.Errorf("expected Offset = %d; got %d", 0, mySuggestion.Offset)
	}
	if mySuggestion.Length != 7 {
		t.Errorf("expected Length = %d; got %d", 7, mySuggestion.Length)
	}
	if len(mySuggestion.Options) != 1 {
		t.Errorf("expected 1 option; got %d", len(mySuggestion.Options))
	}
	myOption := mySuggestion.Options[0]
	if myOption.Text != "golang" {
		t.Errorf("expected Text = 'golang'; got %s", myOption.Text)
	}
	if myOption.Score == float32(0.0) {
		t.Errorf("expected Score != 0.0; got %v", myOption.Score)
	}
}
//*/
