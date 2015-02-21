// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"fmt"
	"github.com/araddon/gou"
	"github.com/bmizerany/assert"
	"testing"
)

func TestSearchRequest(t *testing.T) {
	c := NewTestConn()

	qry := map[string]interface{}{
		"query": map[string]interface{}{
			"wildcard": map[string]string{"actor": "a*"},
		},
	}
	out, err := c.Search("github", "", nil, qry)
	//log.Println(out)
	assert.T(t, &out != nil && err == nil, t, "Should get docs")
	expectedDocs := 10
	expectedHits := 621
	assert.T(t, out.Hits.Len() == expectedDocs, t, fmt.Sprintf("Should have %v docs but was %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, t, fmt.Sprintf("Should have %v hits but was %v", expectedHits, out.Hits.Total))
}

func TestSearchSimple(t *testing.T) {
	c := NewTestConn()

	// searching without faceting
	qry := Search("github").Pretty().Query(
		Query().Search("add"),
	)
	out, _ := qry.Result(c)
	// how many different docs used the word "add"
	expectedDocs := 10
	expectedHits := 494
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total= %v", expectedHits, out.Hits.Total))

	// now the same result from a "Simple" search
	out, _ = Search("github").Search("add").Result(c)
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total= %v", expectedHits, out.Hits.Total))
}

func TestSearchRequestQueryString(t *testing.T) {
	c := NewTestConn()

	out, err := c.SearchUri("github", "", map[string]interface{}{"q": "actor:a*"})
	expectedHits := 621
	assert.T(t, &out != nil && err == nil, "Should get docs")
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v hits but was %v", expectedHits, out.Hits.Total))
}

func TestSearchFacetOne(t *testing.T) {
	/*
		A faceted search for what "type" of events there are
		- since we are not specifying an elasticsearch type it searches all ()

		{
		    "terms" : {
		      "_type" : "terms",
		      "missing" : 0,
		      "total" : 7561,
		      "other" : 0,
		      "terms" : [ {
		        "term" : "pushevent",
		        "count" : 4185
		      }, {
		        "term" : "createevent",
		        "count" : 786
		      }.....]
		    }
		 }

	*/
	c := NewTestConn()

	qry := Search("github").Pretty().Facet(
		Facet().Fields("type").Size("25"),
	).Query(
		Query().All(),
	).Size("1")
	out, err := qry.Result(c)
	//log.Println(string(out.Facets))
	//gou.Debug(out)
	assert.T(t, out != nil && err == nil, "Should have output")
	if out == nil {
		t.Fail()
		return
	}
	h := gou.NewJsonHelper(out.Facets)
	expectedTotal := 8084
	expectedTerms := 16
	assert.T(t, h.Int("type.total") == expectedTotal, fmt.Sprintf("Should have %v results %v", expectedTotal, h.Int("type.total")))
	assert.T(t, len(h.List("type.terms")) == expectedTerms, fmt.Sprintf("Should have %v event types, %v", expectedTerms, len(h.List("type.terms"))))

	// Now, lets try changing size to 10
	qry.FacetVal.Size("10")
	out, err = qry.Result(c)
	h = gou.NewJsonHelper(out.Facets)

	// still same doc count
	assert.T(t, h.Int("type.total") == expectedTotal, fmt.Sprintf("Should have %v results %v", expectedTotal, h.Int("type.total")))
	// make sure size worked
	expectedTerms = 10
	assert.T(t, len(h.List("type.terms")) == expectedTerms, fmt.Sprintf("Should have %v event types, got %v", expectedTerms, len(h.List("type.terms"))))

	// now, lets add a type (out of the 16)
	out, _ = Search("github").Type("IssueCommentEvent").Pretty().Facet(
		Facet().Fields("type").Size("25"),
	).Query(
		Query().All(),
	).Result(c)
	h = gou.NewJsonHelper(out.Facets)
	//log.Println(string(out.Facets))
	// still same doc count
	expectedTotal = 685
	assert.T(t, h.Int("type.total") == expectedTotal, fmt.Sprintf("Should have %v results %v", expectedTotal, h.Int("type.total")))
	// we should only have one facettype because we limited to one type
	assert.T(t, len(h.List("type.terms")) == 1, fmt.Sprintf("Should have 1 event types, %v", len(h.List("type.terms"))))

	// now, add a second type (chained)
	out, _ = Search("github").Type("IssueCommentEvent").Type("PushEvent").Pretty().Facet(
		Facet().Fields("type").Size("25"),
	).Query(
		Query().All(),
	).Result(c)
	h = gou.NewJsonHelper(out.Facets)
	// still same doc count
	expectedTotal = 4941
	expectedTerms = 2
	assert.T(t, h.Int("type.total") == expectedTotal, fmt.Sprintf("Should have %v results %v", expectedTotal, h.Int("type.total")))
	// make sure we now have 2 types
	assert.T(t, len(h.List("type.terms")) == expectedTerms, fmt.Sprintf("Should have %v event types, %v", expectedTerms, len(h.List("type.terms"))))

	//and instead of faceting on type, facet on userid
	// now, add a second type (chained)
	out, _ = Search("github").Type("IssueCommentEvent,PushEvent").Pretty().Facet(
		Facet().Fields("actor").Size("500"),
	).Query(
		Query().All(),
	).Result(c)
	h = gou.NewJsonHelper(out.Facets)
	// still same doc count
	expectedTotal = 5168
	expectedTerms = 500
	assert.T(t, h.Int("actor.total") == expectedTotal, t, fmt.Sprintf("Should have %v results %v", expectedTotal, h.Int("actor.total")))
	// make sure size worked
	assert.T(t, len(h.List("actor.terms")) == expectedTerms, t, fmt.Sprintf("Should have %v users, %v", expectedTerms, len(h.List("actor.terms"))))

}

func TestSearchFacetRange(t *testing.T) {
	c := NewTestConn()

	// ok, now lets try facet but on actor field with a range
	qry := Search("github").Pretty().Facet(
		Facet().Fields("actor").Size("500"),
	).Query(
		Query().Search("add"),
	)
	out, err := qry.Result(c)
	assert.T(t, out != nil && err == nil, t, "Should have output")

	if out == nil {
		t.Fail()
		return
	}
	//log.Println(string(out.Facets))
	h := gou.NewJsonHelper(out.Facets)
	expectedActorTotal := 521
	// how many different docs used the word "add", during entire time range
	assert.T(t, h.Int("actor.total") == expectedActorTotal, fmt.Sprintf("Should have %v results %v", expectedActorTotal, h.Int("actor.total")))
	// make sure size worked
	expectedTerms := 366
	assert.T(t, len(h.List("actor.terms")) == expectedTerms,
		fmt.Sprintf("Should have %v unique userids, %v", expectedTerms, len(h.List("actor.terms"))))

	// ok, repeat but with a range showing different results
	qry = Search("github").Pretty().Facet(
		Facet().Fields("actor").Size("500"),
	).Query(
		Query().Range(
			Range().Field("created_at").From("2012-12-10T15:00:00-08:00").To("2012-12-10T15:10:00-08:00"),
		).Search("add"),
	)
	out, err = qry.Result(c)
	assert.T(t, out != nil && err == nil, t, "Should have output")

	if out == nil {
		t.Fail()
		return
	}
	//log.Println(string(out.Facets))
	h = gou.NewJsonHelper(out.Facets)
	// how many different events used the word "add", during time range?
	expectedActorTotal = 97
	expectedTerms = 71
	assert.T(t, h.Int("actor.total") == expectedActorTotal, fmt.Sprintf("Should have %v results %v", expectedActorTotal, h.Int("actor.total")))
	// make sure size worked
	assert.T(t, len(h.List("actor.terms")) == expectedTerms,
		fmt.Sprintf("Should have %v event types, %v", expectedTerms, len(h.List("actor.terms"))))

}

func TestSearchTerm(t *testing.T) {
	c := NewTestConn()

	// ok, now lets try searching with term query (specific field/term)
	qry := Search("github").Query(
		Query().Term("repository.name", "jasmine"),
	)
	out, _ := qry.Result(c)
	// how many different docs have jasmine in repository.name?
	expectedDocs := 4
	expectedHits := 4
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total= %v", expectedHits, out.Hits.Total))
}

func TestSearchFields(t *testing.T) {
	c := NewTestConn()

	// same as terms, search using fields:
	//    how many different docs have jasmine in repository.name?
	qry := Search("github").Query(
		Query().Fields("repository.name", "jasmine", "", ""),
	)
	out, _ := qry.Result(c)
	expectedDocs := 4
	expectedHits := 4
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total= %v", expectedHits, out.Hits.Total))
}

func TestSearchMissingExists(t *testing.T) {
	c := NewTestConn()

	// search for docs that are missing repository.name
	qry := Search("github").Filter(
		Filter().Exists("repository.name"),
	)
	out, _ := qry.Result(c)
	expectedDocs := 10
	expectedTotal := 7695
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total= %v", expectedTotal, out.Hits.Total))

	qry = Search("github").Filter(
		Filter().Missing("repository.name"),
	)
	out, _ = qry.Result(c)
	expectedDocs = 10
	expectedTotal = 390
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total= %v", expectedTotal, out.Hits.Total))
}

func TestSearchFilterQuery(t *testing.T) {
	c := NewTestConn()

	// compound query + filter with query being wildcard
	out, _ := Search("github").Size("25").Query(
		Query().Fields("repository.name", "jas*", "", ""),
	).Filter(
		Filter().Terms("repository.has_wiki", true),
	).Result(c)
	if out == nil || &out.Hits == nil {
		t.Fail()
		return
	}

	expectedDocs := 7
	expectedTotal := 7
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total= %v", expectedTotal, out.Hits.Total))
}

func TestSearchRange(t *testing.T) {
	c := NewTestConn()

	// now lets filter by a subset of the total time
	out, _ := Search("github").Size("25").Query(
		Query().Range(
			Range().Field("created_at").From("2012-12-10T15:00:00-08:00").To("2012-12-10T15:10:00-08:00"),
		).Search("add"),
	).Result(c)
	assert.T(t, out != nil && &out.Hits != nil, "Must not have nil results, or hits")
	assert.T(t, out.Hits.Len() == 25, fmt.Sprintf("Should have 25 docs %v", out.Hits.Len()))
	assert.T(t, out.Hits.Total == 92, fmt.Sprintf("Should have total=92 but was %v", out.Hits.Total))
}

func TestSearchSortOrder(t *testing.T) {
	c := NewTestConn()

	// ok, now lets try sorting by repository watchers descending
	qry := Search("github").Pretty().Query(
		Query().All(),
	).Sort(
		Sort("repository.watchers").Desc(),
	)
	out, _ := qry.Result(c)

	// how many different docs used the word "add", during entire time range
	expectedDocs := 10
	expectedTotal := 8085
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total= %v", expectedTotal, out.Hits.Total))
	b, err := out.Hits.Hits[0].Source.MarshalJSON()
	assert.T(t, err == nil, fmt.Sprintf("Should not have returned an error: %v", err))
	h1 := gou.NewJsonHelper(b)
	assert.T(t, h1.Int("repository.watchers") == 41377,
		fmt.Sprintf("Should have 41377 watchers= %v", h1.Int("repository.watchers")))

	// ascending
	out, _ = Search("github").Pretty().Query(
		Query().All(),
	).Sort(
		Sort("repository.watchers"),
	).Result(c)
	// how many different docs used the word "add", during entire time range
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total got %v", expectedTotal, out.Hits.Total))
	b, err = out.Hits.Hits[0].Source.MarshalJSON()
	assert.T(t, err == nil, fmt.Sprintf("Should not have returned an error: %v", err))
	h2 := gou.NewJsonHelper(b)
	assert.T(t, h2.Int("repository.watchers") == 0,
		fmt.Sprintf("Should have 0 watchers= %v", h2.Int("repository.watchers")))

	// sort descending with search
	out, _ = Search("github").Pretty().Size("5").Query(
		Query().Search("python"),
	).Sort(
		Sort("repository.watchers").Desc(),
	).Result(c)
	// how many different docs used the word "add", during entire time range
	expectedDocs = 5
	expectedTotal = 734

	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedTotal, fmt.Sprintf("Should have %v total got %v", expectedTotal, out.Hits.Total))

	b, err = out.Hits.Hits[0].Source.MarshalJSON()
	assert.T(t, err == nil, fmt.Sprintf("Should not have returned an error: %v", err))
	h3 := gou.NewJsonHelper(b)
	watchers := 8659
	assert.T(t, h3.Int("repository.watchers") == watchers,
		fmt.Sprintf("Should have %v watchers, got %v", watchers, h3.Int("repository.watchers")))

}
