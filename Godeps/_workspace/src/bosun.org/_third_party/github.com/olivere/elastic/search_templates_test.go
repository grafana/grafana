// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"testing"
)

func TestSearchTemplatesLifecycle(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	// Template
	tmpl := `{"template":{"query":{"match":{"title":"{{query_string}}"}}}}`

	// Create template
	cresp, err := client.PutTemplate().Id("elastic-test").BodyString(tmpl).Do()
	if err != nil {
		t.Fatal(err)
	}
	if cresp == nil {
		t.Fatalf("expected response != nil; got: %v", cresp)
	}
	if !cresp.Created {
		t.Errorf("expected created = %v; got: %v", true, cresp.Created)
	}

	// Get template
	resp, err := client.GetTemplate().Id("elastic-test").Do()
	if err != nil {
		t.Fatal(err)
	}
	if resp == nil {
		t.Fatalf("expected response != nil; got: %v", resp)
	}
	if resp.Template == "" {
		t.Errorf("expected template != %q; got: %q", "", resp.Template)
	}

	// Delete template
	dresp, err := client.DeleteTemplate().Id("elastic-test").Do()
	if err != nil {
		t.Fatal(err)
	}
	if dresp == nil {
		t.Fatalf("expected response != nil; got: %v", dresp)
	}
	if !dresp.Found {
		t.Fatalf("expected found = %v; got: %v", true, dresp.Found)
	}
}

func TestSearchTemplatesInlineQuery(t *testing.T) {
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

	// Run query with (inline) search template
	// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-template-query.html
	tq := NewTemplateQuery(`{"match_{{template}}": {}}`).Var("template", "all")
	resp, err := client.Search(testIndexName).Query(&tq).Do()
	if err != nil {
		t.Fatal(err)
	}
	if resp == nil {
		t.Fatalf("expected response != nil; got: %v", resp)
	}
	if resp.Hits == nil {
		t.Fatalf("expected response hits != nil; got: %v", resp.Hits)
	}
	if resp.Hits.TotalHits != 3 {
		t.Fatalf("expected 3 hits; got: %d", resp.Hits.TotalHits)
	}
}
