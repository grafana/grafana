// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	_ "net/http"
	"reflect"
	"testing"
	"time"
)

func TestSearchMatchAll(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	// Match all should return all documents
	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(&all).Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 4 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 4, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 4 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 4, len(searchResult.Hits.Hits))
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
	client := setupTestClientAndCreateIndexAndAddDocs(b)

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
		if searchResult.Hits.TotalHits != 4 {
			b.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 4, searchResult.Hits.TotalHits)
		}
		if len(searchResult.Hits.Hits) != 4 {
			b.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 4, len(searchResult.Hits.Hits))
		}
	}
}

func TestSearchResultTotalHits(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	count, err := client.Count(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(&all).Do()
	if err != nil {
		t.Fatal(err)
	}

	got := searchResult.TotalHits()
	if got != count {
		t.Fatalf("expected %d hits; got: %d", count, got)
	}

	// No hits
	searchResult = &SearchResult{}
	got = searchResult.TotalHits()
	if got != 0 {
		t.Errorf("expected %d hits; got: %d", 0, got)
	}
}

func TestSearchResultEach(t *testing.T) {
	client := setupTestClientAndCreateIndexAndAddDocs(t)

	all := NewMatchAllQuery()
	searchResult, err := client.Search().Index(testIndexName).Query(&all).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Iterate over non-ptr type
	var aTweet tweet
	count := 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_, ok := item.(tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}
	}
	if count == 0 {
		t.Errorf("expected to find some hits; got: %d", count)
	}

	// Iterate over ptr-type
	count = 0
	var aTweetPtr *tweet
	for _, item := range searchResult.Each(reflect.TypeOf(aTweetPtr)) {
		count++
		tw, ok := item.(*tweet)
		if !ok {
			t.Fatalf("expected hit to be serialized as tweet; got: %v", reflect.ValueOf(item))
		}
		if tw == nil {
			t.Fatal("expected hit to not be nil")
		}
	}
	if count == 0 {
		t.Errorf("expected to find some hits; got: %d", count)
	}

	// Does not iterate when no hits are found
	searchResult = &SearchResult{Hits: nil}
	count = 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_ = item
	}
	if count != 0 {
		t.Errorf("expected to not find any hits; got: %d", count)
	}
	searchResult = &SearchResult{Hits: &SearchHits{Hits: make([]*SearchHit, 0)}}
	count = 0
	for _, item := range searchResult.Each(reflect.TypeOf(aTweet)) {
		count++
		_ = item
	}
	if count != 0 {
		t.Errorf("expected to not find any hits; got: %d", count)
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
		field, found := hit.Fields["message"]
		if !found {
			t.Errorf("expected SearchResult.Hits.Hit.Fields[%s] to be found", "message")
		}
		fields, ok := field.([]interface{})
		if !ok {
			t.Errorf("expected []interface{}; got: %v", reflect.TypeOf(fields))
		}
		if len(fields) != 1 {
			t.Errorf("expected a field with 1 entry; got: %d", len(fields))
		}
		message, ok := fields[0].(string)
		if !ok {
			t.Errorf("expected a string; got: %v", reflect.TypeOf(fields[0]))
		}
		if message == "" {
			t.Errorf("expected a message; got: %q", message)
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

func TestSearchInnerHitsOnHasChild(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Check for valid ES version
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "1.5.0" {
		t.Skip("InnerHits feature is only available for Elasticsearch 1.5+")
		return
	}

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
	comment2a := comment{User: "sandrae", Comment: "What does that even mean?"}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}
	comment3a := comment{User: "nico", Comment: "You bet."}
	comment3b := comment{User: "olivere", Comment: "It sure is."}

	// Add all documents
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t2").BodyJson(&tweet2).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c2a").Parent("t2").BodyJson(&comment2a).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t3").BodyJson(&tweet3).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c3a").Parent("t3").BodyJson(&comment3a).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c3b").Parent("t3").BodyJson(&comment3b).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	fq := NewFilteredQuery(NewMatchAllQuery())
	fq = fq.Filter(
		NewHasChildFilter("comment").
			Query(NewMatchAllQuery()).
			InnerHit(NewInnerHit().Name("comments")))

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(fq).
		Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult.Hits.TotalHits != 2 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 2, searchResult.Hits.TotalHits)
	}
	if len(searchResult.Hits.Hits) != 2 {
		t.Errorf("expected len(SearchResult.Hits.Hits) = %d; got %d", 2, len(searchResult.Hits.Hits))
	}

	hit := searchResult.Hits.Hits[0]
	if hit.Id != "t2" {
		t.Fatalf("expected tweet %q; got: %q", "t2", hit.Id)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if len(hit.InnerHits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(hit.InnerHits))
	}
	innerHits, found := hit.InnerHits["comments"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "comments")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if len(innerHits.Hits.Hits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(innerHits.Hits.Hits))
	}
	if innerHits.Hits.Hits[0].Id != "c2a" {
		t.Fatalf("expected inner hit with id %q; got: %q", "c2a", innerHits.Hits.Hits[0].Id)
	}

	hit = searchResult.Hits.Hits[1]
	if hit.Id != "t3" {
		t.Fatalf("expected tweet %q; got: %q", "t3", hit.Id)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if len(hit.InnerHits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(hit.InnerHits))
	}
	innerHits, found = hit.InnerHits["comments"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "comments")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if len(innerHits.Hits.Hits) != 2 {
		t.Fatalf("expected %d inner hits; got: %d", 2, len(innerHits.Hits.Hits))
	}
	if innerHits.Hits.Hits[0].Id != "c3a" {
		t.Fatalf("expected inner hit with id %q; got: %q", "c3a", innerHits.Hits.Hits[0].Id)
	}
	if innerHits.Hits.Hits[1].Id != "c3b" {
		t.Fatalf("expected inner hit with id %q; got: %q", "c3b", innerHits.Hits.Hits[1].Id)
	}
}

func TestSearchInnerHitsOnHasParent(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Check for valid ES version
	esversion, err := client.ElasticsearchVersion(DefaultURL)
	if err != nil {
		t.Fatal(err)
	}
	if esversion < "1.5.0" {
		t.Skip("InnerHits feature is only available for Elasticsearch 1.5+")
		return
	}

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
	comment2a := comment{User: "sandrae", Comment: "What does that even mean?"}
	tweet3 := tweet{
		User: "sandrae", Retweets: 12,
		Message: "Cycling is fun.",
		Created: time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
	}
	comment3a := comment{User: "nico", Comment: "You bet."}
	comment3b := comment{User: "olivere", Comment: "It sure is."}

	// Add all documents
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t2").BodyJson(&tweet2).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c2a").Parent("t2").BodyJson(&comment2a).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("t3").BodyJson(&tweet3).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c3a").Parent("t3").BodyJson(&comment3a).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Index().Index(testIndexName).Type("comment").Id("c3b").Parent("t3").BodyJson(&comment3b).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}

	fq := NewFilteredQuery(NewMatchAllQuery())
	fq = fq.Filter(
		NewHasParentFilter("tweet").
			Query(NewMatchAllQuery()).
			InnerHit(NewInnerHit().Name("tweets")))

	searchResult, err := client.Search().
		Index(testIndexName).
		Query(fq).
		Pretty(true).
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

	hit := searchResult.Hits.Hits[0]
	if hit.Id != "c2a" {
		t.Fatalf("expected tweet %q; got: %q", "c2a", hit.Id)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if len(hit.InnerHits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(hit.InnerHits))
	}
	innerHits, found := hit.InnerHits["tweets"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "tweets")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if len(innerHits.Hits.Hits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(innerHits.Hits.Hits))
	}
	if innerHits.Hits.Hits[0].Id != "t2" {
		t.Fatalf("expected inner hit with id %q; got: %q", "t2", innerHits.Hits.Hits[0].Id)
	}

	hit = searchResult.Hits.Hits[1]
	if hit.Id != "c3a" {
		t.Fatalf("expected tweet %q; got: %q", "c3a", hit.Id)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if len(hit.InnerHits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(hit.InnerHits))
	}
	innerHits, found = hit.InnerHits["tweets"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "tweets")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if len(innerHits.Hits.Hits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(innerHits.Hits.Hits))
	}
	if innerHits.Hits.Hits[0].Id != "t3" {
		t.Fatalf("expected inner hit with id %q; got: %q", "t3", innerHits.Hits.Hits[0].Id)
	}

	hit = searchResult.Hits.Hits[2]
	if hit.Id != "c3b" {
		t.Fatalf("expected tweet %q; got: %q", "c3b", hit.Id)
	}
	if hit.InnerHits == nil {
		t.Fatalf("expected inner hits; got: %v", hit.InnerHits)
	}
	if len(hit.InnerHits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(hit.InnerHits))
	}
	innerHits, found = hit.InnerHits["tweets"]
	if !found {
		t.Fatalf("expected inner hits for name %q", "tweets")
	}
	if innerHits == nil || innerHits.Hits == nil {
		t.Fatal("expected inner hits != nil")
	}
	if len(innerHits.Hits.Hits) != 1 {
		t.Fatalf("expected %d inner hits; got: %d", 1, len(innerHits.Hits.Hits))
	}
	if innerHits.Hits.Hits[0].Id != "t3" {
		t.Fatalf("expected inner hit with id %q; got: %q", "t3", innerHits.Hits.Hits[0].Id)
	}
}
