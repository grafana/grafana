// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestAliases(t *testing.T) {
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

	// Alias should not yet exist
	aliasesResult1, err := client.Aliases().
		Indices(testIndexName, testIndexName2).
		//Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if len(aliasesResult1.Indices) != 2 {
		t.Errorf("expected len(AliasesResult.Indices) = %d; got %d", 2, len(aliasesResult1.Indices))
	}
	for indexName, indexDetails := range aliasesResult1.Indices {
		if len(indexDetails.Aliases) != 0 {
			t.Errorf("expected len(AliasesResult.Indices[%s].Aliases) = %d; got %d", indexName, 0, len(indexDetails.Aliases))
		}
	}

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

	// Alias should now exist
	aliasesResult2, err := client.Aliases().
		Indices(testIndexName, testIndexName2).
		//Pretty(true).
		Do()
	if err != nil {
		t.Fatal(err)
	}
	if len(aliasesResult2.Indices) != 2 {
		t.Errorf("expected len(AliasesResult.Indices) = %d; got %d", 2, len(aliasesResult2.Indices))
	}
	for indexName, indexDetails := range aliasesResult2.Indices {
		if len(indexDetails.Aliases) != 1 {
			t.Errorf("expected len(AliasesResult.Indices[%s].Aliases) = %d; got %d", indexName, 1, len(indexDetails.Aliases))
		}
	}

	// Check the reverse function:
	indexInfo1, found := aliasesResult2.Indices[testIndexName]
	if !found {
		t.Errorf("expected info about index %s = %v; got %v", testIndexName, true, found)
	}
	aliasFound := indexInfo1.HasAlias(testAliasName)
	if !aliasFound {
		t.Errorf("expected alias %s to include index %s; got %v", testAliasName, testIndexName, aliasFound)
	}

	// Check the reverse function:
	indexInfo2, found := aliasesResult2.Indices[testIndexName2]
	if !found {
		t.Errorf("expected info about index %s = %v; got %v", testIndexName, true, found)
	}
	aliasFound = indexInfo2.HasAlias(testAliasName)
	if !aliasFound {
		t.Errorf("expected alias %s to include index %s; got %v", testAliasName, testIndexName2, aliasFound)
	}

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

	// Alias should now exist only for index 2
	aliasesResult3, err := client.Aliases().Indices(testIndexName, testIndexName2).Do()
	if err != nil {
		t.Fatal(err)
	}
	if len(aliasesResult3.Indices) != 2 {
		t.Errorf("expected len(AliasesResult.Indices) = %d; got %d", 2, len(aliasesResult3.Indices))
	}
	for indexName, indexDetails := range aliasesResult3.Indices {
		if indexName == testIndexName {
			if len(indexDetails.Aliases) != 0 {
				t.Errorf("expected len(AliasesResult.Indices[%s].Aliases) = %d; got %d", indexName, 0, len(indexDetails.Aliases))
			}
		} else if indexName == testIndexName2 {
			if len(indexDetails.Aliases) != 1 {
				t.Errorf("expected len(AliasesResult.Indices[%s].Aliases) = %d; got %d", indexName, 1, len(indexDetails.Aliases))
			}
		} else {
			t.Errorf("got index %s", indexName)
		}
	}
}
