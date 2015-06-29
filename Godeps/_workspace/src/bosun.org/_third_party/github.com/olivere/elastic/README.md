# Elastic

Elastic is an [Elasticsearch](http://www.elasticsearch.org/) client for the
[Go](http://www.golang.org/) programming language.

[![Build Status](https://travis-ci.org/olivere/elastic.svg?branch=master)](https://travis-ci.org/olivere/elastic)
[![Godoc](http://img.shields.io/badge/godoc-reference-blue.svg?style=flat)](https://godoc.org/github.com/olivere/elastic)
[![license](http://img.shields.io/badge/license-MIT-red.svg?style=flat)](https://raw.githubusercontent.com/olivere/elastic/master/LICENSE)

See the [wiki](https://github.com/olivere/elastic/wiki) for additional information about Elastic.


## Releases

### Current version

This is the source code of the current version of Elastic (version 2).

### Earlier versions

If you came from an earlier version and found that you cannot update, don't
worry. Earlier versions are still available. All you need to do is go-get
them and change your import path. See below for details. Here's what you
need to do to use Elastic version 1:

```sh
$ go get gopkg.in/olivere/elastic.v1
```

Then change your import path:

```go
import "gopkg.in/olivere/elastic.v1"
```


## Status

We use Elastic in production since 2012. Although Elastic is quite stable
from our experience, we don't have a stable API yet. The reason for this
is that Elasticsearch changes quite often and at a fast pace.
At this moment we focus on features, not on a stable API.

Having said that, there have been no big API changes that required you
to rewrite your application big time.
More often than not it's renaming APIs and adding/removing features
so that we are in sync with the Elasticsearch API.

Elastic supports and has been tested in production with
the following Elasticsearch versions: 0.90, 1.0, 1.1, 1.2, 1.3, and 1.4.

Elasticsearch has quite a few features. A lot of them are
not yet implemented in Elastic (see below for details).
I add features and APIs as required. It's straightforward
to implement missing pieces. I'm accepting pull requests :-)

Having said that, I hope you find the project useful.


## Usage

The first thing you do is to create a Client. The client connects to
Elasticsearch on http://127.0.0.1:9200 by default.

You typically create one client for your app. Here's a complete example.

```go
// Create a client
client, err := elastic.NewClient()
if err != nil {
    // Handle error
}

// Create an index
_, err = client.CreateIndex("twitter").Do()
if err != nil {
    // Handle error
    panic(err)
}

// Add a document to the index
tweet := Tweet{User: "olivere", Message: "Take Five"}
_, err = client.Index().
    Index("twitter").
    Type("tweet").
    Id("1").
    BodyJson(tweet).
    Do()
if err != nil {
    // Handle error
    panic(err)
}

// Search with a term query
termQuery := elastic.NewTermQuery("user", "olivere")
searchResult, err := client.Search().
    Index("twitter").   // search in index "twitter"
    Query(&termQuery).  // specify the query
    Sort("user", true). // sort by "user" field, ascending
    From(0).Size(10).   // take documents 0-9
    Pretty(true).       // pretty print request and response JSON
    Do()                // execute
if err != nil {
    // Handle error
    panic(err)
}

// searchResult is of type SearchResult and returns hits, suggestions,
// and all kinds of other information from Elasticsearch.
fmt.Printf("Query took %d milliseconds\n", searchResult.TookInMillis)

// Each is a convenience function that iterates over hits in a search result.
// It makes sure you don't need to check for nil values in the response.
// However, it ignores errors in serialization. If you want full control
// over iterating the hits, see below.
var ttyp Tweet
for _, item := range searchResult.Each(reflect.TypeOf(ttyp)) {
    if t, ok := item.(Tweet); ok {
        fmt.Printf("Tweet by %s: %s\n", t.User, t.Message)
    }
}
// TotalHits is another convenience function that works even when something goes wrong.
fmt.Printf("Found a total of %d tweets\n", searchResult.TotalHits())

// Here's how you iterate through results with full control over each step.
if searchResult.Hits != nil {
    fmt.Printf("Found a total of %d tweets\n", searchResult.Hits.TotalHits)

    // Iterate through results
    for _, hit := range searchResult.Hits.Hits {
        // hit.Index contains the name of the index

        // Deserialize hit.Source into a Tweet (could also be just a map[string]interface{}).
        var t Tweet
        err := json.Unmarshal(*hit.Source, &t)
        if err != nil {
            // Deserialization failed
        }

        // Work with tweet
        fmt.Printf("Tweet by %s: %s\n", t.User, t.Message)
    }
} else {
    // No hits
    fmt.Print("Found no tweets\n")
}

// Delete the index again
_, err = client.DeleteIndex("twitter").Do()
if err != nil {
    // Handle error
    panic(err)
}
```

See the [wiki](https://github.com/olivere/elastic/wiki) for more details.


## API Status

Here's the current API status.

### APIs

- [x] Search (most queries, filters, facets, aggregations etc. are implemented: see below)
- [x] Index
- [x] Get
- [x] Delete
- [x] Delete By Query
- [x] Update
- [x] Multi Get
- [x] Bulk
- [ ] Bulk UDP
- [ ] Term vectors
- [ ] Multi term vectors
- [x] Count
- [ ] Validate
- [x] Explain
- [x] Search
- [ ] Search shards
- [x] Search template
- [x] Facets (most are implemented, see below)
- [x] Aggregates (most are implemented, see below)
- [x] Multi Search
- [x] Percolate
- [ ] More like this
- [ ] Benchmark

### Indices

- [x] Create index
- [x] Delete index
- [x] Get index
- [x] Indices exists
- [x] Open/close index
- [x] Put mapping
- [x] Get mapping
- [ ] Get field mapping
- [x] Types exist
- [x] Delete mapping
- [x] Index aliases
- [ ] Update indices settings
- [x] Get settings
- [ ] Analyze
- [x] Index templates
- [ ] Warmers
- [ ] Status
- [x] Indices stats
- [ ] Indices segments
- [ ] Indices recovery
- [ ] Clear cache
- [x] Flush
- [x] Refresh
- [x] Optimize
- [ ] Upgrade

### Snapshot and Restore

- [ ] Snapshot
- [ ] Restore
- [ ] Snapshot status
- [ ] Monitoring snapshot/restore progress
- [ ] Partial restore

### Cat APIs

Not implemented. Those are better suited for operating with Elasticsearch
on the command line.

### Cluster

- [x] Health
- [x] State
- [x] Stats
- [ ] Pending cluster tasks
- [ ] Cluster reroute
- [ ] Cluster update settings
- [ ] Nodes stats
- [x] Nodes info
- [ ] Nodes hot_threads
- [ ] Nodes shutdown

### Search

- [x] Inner hits (for ES >= 1.5.0; see [docs](www.elastic.co/guide/en/elasticsearch/reference/1.5/search-request-inner-hits.html))

### Query DSL

#### Queries

- [x] `match`
- [x] `multi_match`
- [x] `bool`
- [x] `boosting`
- [ ] `common_terms`
- [ ] `constant_score`
- [x] `dis_max`
- [x] `filtered`
- [x] `fuzzy_like_this_query` (`flt`)
- [x] `fuzzy_like_this_field_query` (`flt_field`)
- [x] `function_score`
- [x] `fuzzy`
- [ ] `geo_shape`
- [x] `has_child`
- [x] `has_parent`
- [x] `ids`
- [ ] `indices`
- [x] `match_all`
- [x] `mlt`
- [x] `mlt_field`
- [x] `nested`
- [x] `prefix`
- [x] `query_string`
- [x] `simple_query_string`
- [x] `range`
- [x] `regexp`
- [ ] `span_first`
- [ ] `span_multi_term`
- [ ] `span_near`
- [ ] `span_not`
- [ ] `span_or`
- [ ] `span_term`
- [x] `term`
- [x] `terms`
- [ ] `top_children`
- [x] `wildcard`
- [ ] `minimum_should_match`
- [ ] `multi_term_query_rewrite`
- [x] `template_query`

#### Filters

- [x] `and`
- [x] `bool`
- [x] `exists`
- [ ] `geo_bounding_box`
- [x] `geo_distance`
- [ ] `geo_distance_range`
- [x] `geo_polygon`
- [ ] `geoshape`
- [ ] `geohash`
- [x] `has_child`
- [x] `has_parent`
- [x] `ids`
- [ ] `indices`
- [x] `limit`
- [x] `match_all`
- [x] `missing`
- [x] `nested`
- [x] `not`
- [x] `or`
- [x] `prefix`
- [x] `query`
- [x] `range`
- [x] `regexp`
- [ ] `script`
- [x] `term`
- [x] `terms`
- [x] `type`

### Facets

- [x] Terms
- [x] Range
- [x] Histogram
- [x] Date Histogram
- [x] Filter
- [x] Query
- [x] Statistical
- [x] Terms Stats
- [x] Geo Distance

### Aggregations

- [x] min
- [x] max
- [x] sum
- [x] avg
- [x] stats
- [x] extended stats
- [x] value count
- [x] percentiles
- [x] percentile ranks
- [x] cardinality
- [x] geo bounds
- [x] top hits
- [ ] scripted metric
- [x] global
- [x] filter
- [x] filters
- [x] missing
- [x] nested
- [x] reverse nested
- [x] children
- [x] terms
- [x] significant terms
- [x] range
- [x] date range
- [x] ipv4 range
- [x] histogram
- [x] date histogram
- [x] geo distance
- [x] geohash grid

### Sorting

- [x] Sort by score
- [x] Sort by field
- [x] Sort by geo distance
- [x] Sort by script

### Scan

Scrolling through documents (e.g. `search_type=scan`) are implemented via
the `Scroll` and `Scan` services. The `ClearScroll` API is implemented as well.

## How to contribute

Read [the contribution guidelines](https://github.com/olivere/elastic/blob/master/CONTRIBUTING.md).

## Credits

Thanks a lot for the great folks working hard on
[Elasticsearch](http://www.elasticsearch.org/)
and
[Go](http://www.golang.org/).

## LICENSE

MIT-LICENSE. See [LICENSE](http://olivere.mit-license.org/)
or the LICENSE file provided in the repository for details.

