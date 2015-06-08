// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	_ "net/http"
	"testing"
	"time"
)

func TestSearchMatchAll(t *testing.T) {
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
	searchResult, err := client.Search().Index(testIndexName).Query(&all).Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func BenchmarkSearchMatchAll(b *testing.B) {
	client := setupTestClientAndCreateIndex(b)

	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "olivere", Message: "Another unrelated topic."}
	tweet3 := tweet{User: "sandrae", Message: "Cycling is fun."}

	// Add all documents
	_, err := client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
	if err != nil {
		b.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do()
	if err != nil {
		b.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("3").BodyJson(&tweet3).Do()
	if err != nil {
		b.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		b.Fatal(err)
	}

	for n := 0; n < b.N; n++ {
		// Match all should return all documents
		all := NewMatchAllQuery()
		searchResult, err := client.Search().Index(testIndexName).Query(&all).Do()
		if err != nil {
			b.Fatal(err)
		}
		if searchResult.Hits == nil {
			b.Errorf("expected SearchResult.Hits != nil; got nil")
		}
		if searchResult.Hits.TotalHits != 3 {
			b.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
		}
		if len(searchResult.Hits.Hits) != 3 {
			b.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
		}
	}
}

func TestSearchSorting(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Sort("created", false).
		Timeout("1s").
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSearchSortingBySorters(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		SortBy(NewFieldSort("created").Desc(), NewScoreSort()).
		Timeout("1s").
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		item := make(map[string]interface{})
		err := json.Unmarshal(*hit.Source, &item)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSearchSpecificFields(t *testing.T) {
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
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Fields("message").
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		if hit.Source != nil {
			t.Fatalf("expected SearchResult.Hits.Hit.Source to be nil; got: %q", hit.Source)
		}
		if hit.Fields == nil {
			t.Fatal("expected SearchResult.Hits.Hit.Fields to be != nil")
		}
		if _, found := hit.Fields["message"]; !found {
			t.Errorf("expected SearchResult.Hits.Hit.Fields[%s] to be found", "message")
		}
	}
}

func TestSearchExplain(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().
		Index(testIndexName).
		Query(&all).
		Explain(true).
		Timeout("1s").
		// Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 3 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 3, len(searchResult.Hits.Hits))
	}

	for _, hit := range searchResult.Hits.Hits {
		if hit.Index != testIndexName {
			t.Errorf("expected SearchResult.Hits.Hit.Index = %q; got %q", testIndexName, hit.Index)
		}
		if hit.Explanation == nil {
			t.Fatal("expected search explanation")
		}
		if hit.Explanation.Value <= 0.0 {
			t.Errorf("expected explanation value to be > 0.0; got: %v", hit.Explanation.Value)
		}
		if hit.Explanation.Description == "" {
			t.Errorf("expected explanation description != %q; got: %q", "", hit.Explanation.Description)
		}
	}
}

func TestSearchSource(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Set up the request JSON manually to pass to the search service via Source()
	source := map[string]interface{}{
		"query": map[string]interface{}{
			"match_all": map[string]interface{}{},
		},
	}

	searchResult, err := client.Search().
		Index(testIndexName).
		Source(source). // sets the JSON request
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
}

func TestSearchSearchSource(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User: "olivere", Retweets: 108,
		Message: "Welcome to Golang and Elasticsearch.",
		Created: time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User: "olivere", Retweets: 0,
		Message: "Another unrelated topic.",
		Created: time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Set up the search source manually and pass it to the search service via SearchSource()
	ss := NewSearchSource().Query(NewMatchAllQuery()).From(0).Size(2)

	// One can use ss.Source() to get to the raw interface{} that will be used
	// as the search request JSON by the SearchService.

	searchResult, err := client.Search().
		Index(testIndexName).
		SearchSource(ss). // sets the SearchSource
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 2 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 2, len(searchResult.Hits.Hits))
	}
}
