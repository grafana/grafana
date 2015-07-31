// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	_ "net/http"
	"testing"
)

func TestSuggestService(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User:     "olivere",
		Message:  "Welcome to Golang and Elasticsearch.",
		Tags:     []string{"golang", "elasticsearch"},
		Location: "48.1333,11.5667", // lat,lon
		Suggest: NewSuggestField().
			Input("Welcome to Golang and Elasticsearch.", "Golang and Elasticsearch").
			Output("Golang and Elasticsearch: An introduction.").
			Weight(0),
	}
	tweet2 := tweet{
		User:     "olivere",
		Message:  "Another unrelated topic.",
		Tags:     []string{"golang"},
		Location: "48.1189,11.4289", // lat,lon
		Suggest: NewSuggestField().
			Input("Another unrelated topic.", "Golang topic.").
			Output("About Golang.").
			Weight(1),
	}
	tweet3 := tweet{
		User:     "sandrae",
		Message:  "Cycling is fun.",
		Tags:     []string{"sports", "cycling"},
		Location: "47.7167,11.7167", // lat,lon
		Suggest: NewSuggestField().
			Input("Cycling is fun.").
			Output("Cycling is a fun sport."),
	}

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

	// Test _suggest endpoint
	termSuggesterName := "my-term-suggester"
	termSuggester := NewTermSuggester(termSuggesterName).Text("Goolang").Field("message")
	phraseSuggesterName := "my-phrase-suggester"
	phraseSuggester := NewPhraseSuggester(phraseSuggesterName).Text("Goolang").Field("message")
	completionSuggesterName := "my-completion-suggester"
	completionSuggester := NewCompletionSuggester(completionSuggesterName).Text("Go").Field("suggest_field")

	result, err := client.Suggest().
		Index(testIndexName).
		Suggester(termSuggester).
		Suggester(phraseSuggester).
		Suggester(completionSuggester).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if result == nil {
		t.Errorf("expected result != nil; got nil")
	}
	if len(result) != 3 {
		t.Errorf("expected 3 suggester results; got %d", len(result))
	}

	termSuggestions, found := result[termSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", termSuggesterName)
	}
	if termSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", termSuggesterName)
	}
	if len(termSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(termSuggestions))
	}

	phraseSuggestions, found := result[phraseSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", phraseSuggesterName)
	}
	if phraseSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", phraseSuggesterName)
	}
	if len(phraseSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(phraseSuggestions))
	}

	completionSuggestions, found := result[completionSuggesterName]
	if !found {
		t.Errorf("expected to find Suggest[%s]; got false", completionSuggesterName)
	}
	if completionSuggestions == nil {
		t.Errorf("expected Suggest[%s] != nil; got nil", completionSuggesterName)
	}
	if len(completionSuggestions) != 1 {
		t.Errorf("expected 1 suggestion; got %d", len(completionSuggestions))
	}
	if len(completionSuggestions[0].Options) != 2 {
		t.Errorf("expected 2 suggestion options; got %d", len(completionSuggestions[0].Options))
	}
	if completionSuggestions[0].Options[0].Text != "About Golang." {
		t.Errorf("expected Suggest[%s][0].Options[0].Text == %q; got %q", completionSuggesterName, "About Golang.", completionSuggestions[0].Options[0].Text)
	}
	if completionSuggestions[0].Options[1].Text != "Golang and Elasticsearch: An introduction." {
		t.Errorf("expected Suggest[%s][0].Options[1].Text == %q; got %q", completionSuggesterName, "Golang and Elasticsearch: An introduction.", completionSuggestions[0].Options[1].Text)
	}
}
