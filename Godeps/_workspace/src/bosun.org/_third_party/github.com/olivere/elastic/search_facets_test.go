// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	_ "encoding/json"
	_ "net/http"
	"testing"
	"time"
)

func TestSearchFacets(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	tweet1 := tweet{
		User:     "olivere",
		Retweets: 108,
		Message:  "Welcome to Golang and Elasticsearch.",
		Created:  time.Date(2012, 12, 12, 17, 38, 34, 0, time.UTC),
	}
	tweet2 := tweet{
		User:     "olivere",
		Retweets: 0,
		Message:  "Another unrelated topic.",
		Created:  time.Date(2012, 10, 10, 8, 12, 03, 0, time.UTC),
	}
	tweet3 := tweet{
		User:     "sandrae",
		Retweets: 12,
		Message:  "Cycling is fun.",
		Created:  time.Date(2011, 11, 11, 10, 58, 12, 0, time.UTC),
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

	// Terms Facet by user name
	userFacet := NewTermsFacet().Field("user").Size(10).Order("count")

	// Range Facet by retweets
	retweetsFacet := NewRangeFacet().Field("retweets").Lt(10).Between(10, 100).Gt(100)

	// Histogram Facet by retweets
	retweetsHistoFacet := NewHistogramFacet().KeyField("retweets").Interval(100)

	// Histogram Facet with time interval by retweets
	retweetsTimeHistoFacet := NewHistogramFacet().KeyField("retweets").TimeInterval("1m")

	// Date Histogram Facet by creation date
	dateHisto := NewDateHistogramFacet().Field("created").Interval("year")

	// Date Histogram Facet with Key and Value field by creation date
	dateHistoWithKeyValue := NewDateHistogramFacet().
		Interval("year").
		KeyField("created").
		ValueField("retweets")

	// Query Facet
	queryFacet := NewQueryFacet().Query(NewTermQuery("user", "olivere")).Global(true)

	// Range Facet by creation date
	dateRangeFacet := NewRangeFacet().Field("created").Lt("2012-01-01").Between("2012-01-01", "2013-01-01").Gt("2013-01-01")

	// Range Facet with time.Time by creation date
	d20120101 := time.Date(2012, 1, 1, 0, 0, 0, 0, time.UTC)
	d20130101 := time.Date(2013, 1, 1, 0, 0, 0, 0, time.UTC)
	dateRangeWithTimeFacet := NewRangeFacet().Field("created").
		Lt(d20120101).
		Between(d20120101, d20130101).
		Gt(d20130101)

	// Run query
	searchResult, err := client.Search().Index(testIndexName).
		Query(&all).
		Facet("user", userFacet).
		Facet("retweets", retweetsFacet).
		Facet("retweetsHistogram", retweetsHistoFacet).
		Facet("retweetsTimeHisto", retweetsTimeHistoFacet).
		Facet("dateHisto", dateHisto).
		Facet("createdWithKeyValue", dateHistoWithKeyValue).
		Facet("queryFacet", queryFacet).
		Facet("dateRangeFacet", dateRangeFacet).
		Facet("dateRangeWithTimeFacet", dateRangeWithTimeFacet).
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
	if searchResult.Facets == nil {
		t.Errorf("expected SearchResult.Facets != nil; got nil")
	}

	// Search for non-existent facet field should return (nil, false)
	facet, found := searchResult.Facets["no-such-field"]
	if found {
		t.Errorf("expected SearchResult.Facets.For(...) = %v; got %v", false, found)
	}
	if facet != nil {
		t.Errorf("expected SearchResult.Facets.For(...) = nil; got %v", facet)
	}

	// Search for existent facet should return (facet, true)
	facet, found = searchResult.Facets["user"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"user\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"user\"] != nil; got nil")
	}

	// Check facet details
	if facet.Type != "terms" {
		t.Errorf("expected searchResult.Facets[\"user\"].Type = %v; got %v", "terms", facet.Type)
	}
	if facet.Total != 3 {
		t.Errorf("expected searchResult.Facets[\"user\"].Total = %v; got %v", 3, facet.Total)
	}
	if len(facet.Terms) != 2 {
		t.Errorf("expected len(searchResult.Facets[\"user\"].Terms) = %v; got %v", 2, len(facet.Terms))
	}

	// Search for range facet should return (facet, true)
	facet, found = searchResult.Facets["retweets"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"retweets\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"retweets\"] != nil; got nil")
	}

	// Check facet details
	if facet.Type != "range" {
		t.Errorf("expected searchResult.Facets[\"retweets\"].Type = %v; got %v", "range", facet.Type)
	}
	if len(facet.Ranges) != 3 {
		t.Errorf("expected len(searchResult.Facets[\"retweets\"].Ranges) = %v; got %v", 3, len(facet.Ranges))
	}

	if facet.Ranges[0].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][0].Count = %v; got %v", 1, facet.Ranges[0].Count)
	}
	if facet.Ranges[0].TotalCount != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][0].TotalCount = %v; got %v", 1, facet.Ranges[0].TotalCount)
	}
	if facet.Ranges[0].From != nil {
		t.Errorf("expected searchResult.Facets[\"retweets\"][0].From = %v; got %v", nil, facet.Ranges[0].From)
	}
	if to := facet.Ranges[0].To; to == nil || (*to) != 10.0 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][0].To = %v; got %v", 10.0, to)
	}

	if facet.Ranges[1].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][1].Count = %v; got %v", 1, facet.Ranges[1].Count)
	}
	if facet.Ranges[1].TotalCount != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][1].TotalCount = %v; got %v", 1, facet.Ranges[1].TotalCount)
	}
	if from := facet.Ranges[1].From; from == nil || (*from) != 10.0 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][1].From = %v; got %v", 10.0, from)
	}
	if to := facet.Ranges[1].To; to == nil || (*to) != 100.0 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][1].To = %v; got %v", 100.0, facet.Ranges[1].To)
	}

	if facet.Ranges[2].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][2].Count = %v; got %v", 1, facet.Ranges[2].Count)
	}
	if facet.Ranges[2].TotalCount != 1 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][2].TotalCount = %v; got %v", 1, facet.Ranges[2].TotalCount)
	}
	if from := facet.Ranges[2].From; from == nil || (*from) != 100.0 {
		t.Errorf("expected searchResult.Facets[\"retweets\"][2].From = %v; got %v", 100.0, facet.Ranges[2].From)
	}
	if facet.Ranges[2].To != nil {
		t.Errorf("expected searchResult.Facets[\"retweets\"][2].To = %v; got %v", nil, facet.Ranges[2].To)
	}

	// Search for histogram facet should return (facet, true)
	facet, found = searchResult.Facets["retweetsHistogram"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"] != nil; got nil")
	}

	// Check facet details
	if facet.Type != "histogram" {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"].Type = %v; got %v", "histogram", facet.Type)
	}
	if len(facet.Entries) != 2 {
		t.Errorf("expected len(searchResult.Facets[\"retweetsHistogram\"].Entries) = %v; got %v", 3, len(facet.Entries))
	}
	if facet.Entries[0].Key.(float64) != 0 {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"].Entries[0].Key = %v; got %v", 0, facet.Entries[0].Key)
	}
	if facet.Entries[0].Count != 2 {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"].Entries[0].Count = %v; got %v", 2, facet.Entries[0].Count)
	}
	if facet.Entries[1].Key.(float64) != 100 {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"].Entries[1].Key = %v; got %v", 100, facet.Entries[1].Key)
	}
	if facet.Entries[1].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"retweetsHistogram\"].Entries[1].Count = %v; got %v", 1, facet.Entries[1].Count)
	}

	// Search for histogram facet with time interval should return (facet, true)
	facet, found = searchResult.Facets["retweetsTimeHisto"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"retweetsTimeHisto\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"retweetsTimeHisto\"] != nil; got nil")
	}

	// Search for date histogram facet
	facet, found = searchResult.Facets["dateHisto"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"] != nil; got nil")
	}
	if facet.Entries[0].Time != 1293840000000 {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"].Entries[0].Time = %v; got %v", 1293840000000, facet.Entries[0].Time)
	}
	if facet.Entries[0].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"].Entries[0].Count = %v; got %v", 1, facet.Entries[0].Count)
	}
	if facet.Entries[1].Time != 1325376000000 {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"].Entries[1].Time = %v; got %v", 1325376000000, facet.Entries[0].Time)
	}
	if facet.Entries[1].Count != 2 {
		t.Errorf("expected searchResult.Facets[\"dateHisto\"].Entries[1].Count = %v; got %v", 2, facet.Entries[1].Count)
	}

	// Search for date histogram with key/value fields facet
	facet, found = searchResult.Facets["createdWithKeyValue"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"] != nil; got nil")
	}
	if len(facet.Entries) != 2 {
		t.Errorf("expected len(searchResult.Facets[\"createdWithKeyValue\"].Entries) = %v; got %v", 2, len(facet.Entries))
	}
	if facet.Entries[0].Time != 1293840000000 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Time = %v; got %v", 1293840000000, facet.Entries[0].Time)
	}
	if facet.Entries[0].Count != 1 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Count = %v; got %v", 1, facet.Entries[0].Count)
	}
	if facet.Entries[0].Min.(float64) != 12.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Min = %v; got %v", 12.0, facet.Entries[0].Min)
	}
	if facet.Entries[0].Max.(float64) != 12.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Max = %v; got %v", 12.0, facet.Entries[0].Max)
	}
	if facet.Entries[0].Total != 12.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Total = %v; got %v", 12.0, facet.Entries[0].Total)
	}
	if facet.Entries[0].TotalCount != 1 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].TotalCount = %v; got %v", 1, facet.Entries[0].TotalCount)
	}
	if facet.Entries[0].Mean != 12.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[0].Mean = %v; got %v", 12.0, facet.Entries[0].Mean)
	}
	if facet.Entries[1].Time != 1325376000000 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Time = %v; got %v", 1325376000000, facet.Entries[1].Time)
	}
	if facet.Entries[1].Count != 2 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Count = %v; got %v", 2, facet.Entries[1].Count)
	}
	if facet.Entries[1].Min.(float64) != 0.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Min = %v; got %v", 0.0, facet.Entries[1].Min)
	}
	if facet.Entries[1].Max.(float64) != 108.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Max = %v; got %v", 108.0, facet.Entries[1].Max)
	}
	if facet.Entries[1].Total != 108.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Total = %v; got %v", 108.0, facet.Entries[1].Total)
	}
	if facet.Entries[1].TotalCount != 2 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].TotalCount = %v; got %v", 2, facet.Entries[1].TotalCount)
	}
	if facet.Entries[1].Mean != 54.0 {
		t.Errorf("expected searchResult.Facets[\"createdWithKeyValue\"].Entries[1].Mean = %v; got %v", 54.0, facet.Entries[1].Mean)
	}

	// Search for date range facet
	facet, found = searchResult.Facets["dateRangeFacet"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"] != nil; got nil")
	}
	if len(facet.Ranges) != 3 {
		t.Errorf("expected len(searchResult.Facets[\"dateRangeFacet\"].Ranges) = %v; got %v", 3, len(facet.Ranges))
	}
	if facet.Ranges[0].From != nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[0].From to be nil")
	}
	if facet.Ranges[0].To == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[0].To to be != nil")
	}
	if *facet.Ranges[0].To != 1.325376e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[0].To = %v; got %v", 1.325376e+12, *facet.Ranges[0].To)
	}
	if facet.Ranges[0].ToStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[0].ToStr to be != nil")
	}
	if *facet.Ranges[0].ToStr != "2012-01-01" {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[0].ToStr = %v; got %v", "2012-01-01", *facet.Ranges[0].ToStr)
	}
	if facet.Ranges[1].From == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].From to be != nil")
	}
	if *facet.Ranges[1].From != 1.325376e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].From = %v; got %v", 1.325376e+12, *facet.Ranges[1].From)
	}
	if facet.Ranges[1].FromStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].FromStr to be != nil")
	}
	if *facet.Ranges[1].FromStr != "2012-01-01" {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].FromStr = %v; got %v", "2012-01-01", *facet.Ranges[1].FromStr)
	}
	if facet.Ranges[1].To == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].To to be != nil")
	}
	if *facet.Ranges[1].To != 1.3569984e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].To = %v; got %v", 1.3569984e+12, *facet.Ranges[1].To)
	}
	if facet.Ranges[1].ToStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].ToStr to be != nil")
	}
	if *facet.Ranges[1].ToStr != "2013-01-01" {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[1].ToStr = %v; got %v", "2013-01-01", *facet.Ranges[1].ToStr)
	}
	if facet.Ranges[2].To != nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[2].To to be nil")
	}
	if facet.Ranges[2].From == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[2].From to be != nil")
	}
	if *facet.Ranges[2].From != 1.3569984e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[2].From = %v; got %v", 1.3569984e+12, *facet.Ranges[2].From)
	}
	if facet.Ranges[2].FromStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[2].FromStr to be != nil")
	}
	if *facet.Ranges[2].FromStr != "2013-01-01" {
		t.Errorf("expected searchResult.Facets[\"dateRangeFacet\"].Ranges[2].FromStr = %v; got %v", "2013-01-01", *facet.Ranges[2].FromStr)
	}

	// Search for date range facet
	facet, found = searchResult.Facets["dateRangeWithTimeFacet"]
	if !found {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"] = %v; got %v", true, found)
	}
	if facet == nil {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"] != nil; got nil")
	}
	if len(facet.Ranges) != 3 {
		t.Errorf("expected len(searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges) = %v; got %v", 3, len(facet.Ranges))
	}
	if facet.Ranges[0].From != nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[0].From to be nil")
	}
	if facet.Ranges[0].To == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[0].To to be != nil")
	}
	if *facet.Ranges[0].To != 1.325376e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[0].To = %v; got %v", 1.325376e+12, *facet.Ranges[0].To)
	}
	if facet.Ranges[0].ToStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[0].ToStr to be != nil")
	}
	if *facet.Ranges[0].ToStr != "2012-01-01T00:00:00Z" {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[0].ToStr = %v; got %v", "2012-01-01T00:00:00Z", *facet.Ranges[0].ToStr)
	}
	if facet.Ranges[1].From == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].From to be != nil")
	}
	if *facet.Ranges[1].From != 1.325376e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].From = %v; got %v", 1.325376e+12, *facet.Ranges[1].From)
	}
	if facet.Ranges[1].FromStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].FromStr to be != nil")
	}
	if *facet.Ranges[1].FromStr != "2012-01-01T00:00:00Z" {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].FromStr = %v; got %v", "2012-01-01T00:00:00Z", *facet.Ranges[1].FromStr)
	}
	if facet.Ranges[1].To == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].To to be != nil")
	}
	if *facet.Ranges[1].To != 1.3569984e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].To = %v; got %v", 1.3569984e+12, *facet.Ranges[1].To)
	}
	if facet.Ranges[1].ToStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].ToStr to be != nil")
	}
	if *facet.Ranges[1].ToStr != "2013-01-01T00:00:00Z" {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[1].ToStr = %v; got %v", "2013-01-01T00:00:00Z", *facet.Ranges[1].ToStr)
	}
	if facet.Ranges[2].To != nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[2].To to be nil")
	}
	if facet.Ranges[2].From == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[2].From to be != nil")
	}
	if *facet.Ranges[2].From != 1.3569984e+12 {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[2].From = %v; got %v", 1.3569984e+12, *facet.Ranges[2].From)
	}
	if facet.Ranges[2].FromStr == nil {
		t.Fatalf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[2].FromStr to be != nil")
	}
	if *facet.Ranges[2].FromStr != "2013-01-01T00:00:00Z" {
		t.Errorf("expected searchResult.Facets[\"dateRangeWithTimeFacet\"].Ranges[2].FromStr = %v; got %v", "2013-01-01T00:00:00Z", *facet.Ranges[2].FromStr)
	}

}
