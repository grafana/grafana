// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

const (
	testAliasName = "elastic-test-alias"
)

func TestAliasLifecycle(t *testing.T) {
	var err error

	client := setupTestClientAndCreateIndex(t)

	// Some tweets
	tweet1 := tweet{User: "olivere", Message: "Welcome to Golang and Elasticsearch."}
	tweet2 := tweet{User: "sandrae", Message: "Cycling is fun."}
	tweet3 := tweet{User: "olivere", Message: "Another unrelated topic."}

	// Add tweets to first index
	_, err = client.Index().Index(testIndexName).Type("tweet").Id("1").BodyJson(&tweet1).Do()
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Index().Index(testIndexName).Type("tweet").Id("2").BodyJson(&tweet2).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Add tweets to second index
	_, err = client.Index().Index(testIndexName2).Type("tweet").Id("3").BodyJson(&tweet3).Do()
	if err != nil {
		t.Fatal(err)
	}

	// Flush
	_, err = client.Flush().Index(testIndexName).Do()
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Flush().Index(testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}

	/*
		// Alias should not yet exist
		aliasesResult1, err := client.Aliases().Do()
		if err != nil {
			t.Fatal(err)
		}
		if len(aliasesResult1.Indices) != 0 {
			t.Errorf("expected len(AliasesResult.Indices) = %d; got %d", 0, len(aliasesResult1.Indices))
		}
	*/

	// Add both indices to a new alias
	aliasCreate, err := client.Alias().
		Add(testIndexName, testAliasName).
		Add(testIndexName2, testAliasName).
		//Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if !aliasCreate.Acknowledged {
		t.Errorf("expected AliasResult.Acknowledged %v; got %v", true, aliasCreate.Acknowledged)
	}

	// Search should return all 3 tweets
	matchAll := NewMatchAllQuery()
	searchResult1, err := client.Search().Index(testAliasName).Query(&matchAll).Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult1.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult1.Hits.TotalHits != 3 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 3, searchResult1.Hits.TotalHits)
	}

	/*
		// Alias should return both indices
		aliasesResult2, err := client.Aliases().Do()
		if err != nil {
			t.Fatal(err)
		}
		if len(aliasesResult2.Indices) != 2 {
			t.Errorf("expected len(AliasesResult.Indices) = %d; got %d", 2, len(aliasesResult2.Indices))
		}
	*/

	// Remove first index should remove two tweets, so should only yield 1
	aliasRemove1, err := client.Alias().
		Remove(testIndexName, testAliasName).
		//Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if !aliasRemove1.Acknowledged {
		t.Errorf("expected AliasResult.Acknowledged %v; got %v", true, aliasRemove1.Acknowledged)
	}

	searchResult2, err := client.Search().Index(testAliasName).Query(&matchAll).Do()
	if err != nil {
		t.Fatal(err)
	}
	if searchResult2.Hits == nil {
		t.Errorf("expected SearchResult.Hits != nil; got nil")
	}
	if searchResult2.Hits.TotalHits != 1 {
		t.Errorf("expected SearchResult.Hits.TotalHits = %d; got %d", 1, searchResult2.Hits.TotalHits)
	}

}
