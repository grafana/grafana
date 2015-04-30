// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic_test

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"bosun.org/_third_party/github.com/olivere/elastic"
)

type Tweet struct {
	User     string                `json:"user"`
	Message  string                `json:"message"`
	Retweets int                   `json:"retweets"`
	Image    string                `json:"image,omitempty"`
	Created  time.Time             `json:"created,omitempty"`
	Tags     []string              `json:"tags,omitempty"`
	Location string                `json:"location,omitempty"`
	Suggest  *elastic.SuggestField `json:"suggest_field,omitempty"`
}

func Example() {
	errorlog := log.New(os.Stdout, "APP ", log.LstdFlags)

	// Obtain a client. You can provide your own HTTP client here.
	client, err := elastic.NewClient(elastic.SetErrorLog(errorlog))
	if err != nil {
		// Handle error
		panic(err)
	}

	// Trace request and response details like this
	//client.SetTracer(log.New(os.Stdout, "", 0))

	// Ping the Elasticsearch server to get e.g. the version number
	info, code, err := client.Ping().Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	fmt.Printf("Elasticsearch returned with code %d and version %s", code, info.Version.Number)

	// Getting the ES version number is quite common, so there's a shortcut
	esversion, err := client.ElasticsearchVersion("http://127.0.0.1:9200")
	if err != nil {
		// Handle error
		panic(err)
	}
	fmt.Printf("Elasticsearch version %s", esversion)

	// Use the IndexExists service to check if a specified index exists.
	exists, err := client.IndexExists("twitter").Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if !exists {
		// Create a new index.
		createIndex, err := client.CreateIndex("twitter").Do()
		if err != nil {
			// Handle error
			panic(err)
		}
		if !createIndex.Acknowledged {
			// Not acknowledged
		}
	}

	// Index a tweet (using JSON serialization)
	tweet1 := Tweet{User: "olivere", Message: "Take Five", Retweets: 0}
	put1, err := client.Index().
		Index("twitter").
		Type("tweet").
		Id("1").
		BodyJson(tweet1).
		Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	fmt.Printf("Indexed tweet %s to index %s, type %s\n", put1.Id, put1.Index, put1.Type)

	// Index a second tweet (by string)
	tweet2 := `{"user" : "olivere", "message" : "It's a Raggy Waltz"}`
	put2, err := client.Index().
		Index("twitter").
		Type("tweet").
		Id("2").
		BodyString(tweet2).
		Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	fmt.Printf("Indexed tweet %s to index %s, type %s\n", put2.Id, put2.Index, put2.Type)

	// Get tweet with specified ID
	get1, err := client.Get().
		Index("twitter").
		Type("tweet").
		Id("1").
		Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if get1.Found {
		fmt.Printf("Got document %s in version %d from index %s, type %s\n", get1.Id, get1.Version, get1.Index, get1.Type)
	}

	// Flush to make sure the documents got written.
	_, err = client.Flush().Index("twitter").Do()
	if err != nil {
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

	// Number of hits
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

	// Update a tweet by the update API of Elasticsearch.
	// We just increment the number of retweets.
	update, err := client.Update().Index("twitter").Type("tweet").Id("1").
		Script("ctx._source.retweets += num").
		ScriptParams(map[string]interface{}{"num": 1}).
		Upsert(map[string]interface{}{"retweets": 0}).
		Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	fmt.Printf("New version of tweet %q is now %d", update.Id, update.Version)

	// ...

	// Delete an index.
	deleteIndex, err := client.DeleteIndex("twitter").Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if !deleteIndex.Acknowledged {
		// Not acknowledged
	}
}

func ExampleClient_NewClient_default() {
	// Obtain a client to the Elasticsearch instance on http://localhost:9200.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		fmt.Printf("connection failed: %v\n", err)
	} else {
		fmt.Println("connected")
	}
	_ = client
	// Output:
	// connected
}

func ExampleClient_NewClient_cluster() {
	// Obtain a client for an Elasticsearch cluster of two nodes,
	// running on 10.0.1.1 and 10.0.1.2.
	client, err := elastic.NewClient(elastic.SetURL("http://10.0.1.1:9200", "http://10.0.1.2:9200"))
	if err != nil {
		// Handle error
		panic(err)
	}
	_ = client
}

func ExampleClient_NewClient_manyOptions() {
	// Obtain a client for an Elasticsearch cluster of two nodes,
	// running on 10.0.1.1 and 10.0.1.2. Do not run the sniffer.
	// Set the healthcheck interval to 10s. When requests fail,
	// retry 5 times. Print error messages to os.Stderr and informational
	// messages to os.Stdout.
	client, err := elastic.NewClient(
		elastic.SetURL("http://10.0.1.1:9200", "http://10.0.1.2:9200"),
		elastic.SetSniff(false),
		elastic.SetHealthcheckInterval(10*time.Second),
		elastic.SetMaxRetries(5),
		elastic.SetErrorLog(log.New(os.Stderr, "ELASTIC ", log.LstdFlags)),
		elastic.SetInfoLog(log.New(os.Stdout, "", log.LstdFlags)))
	if err != nil {
		// Handle error
		panic(err)
	}
	_ = client
}

func ExampleIndexExistsService() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}
	// Use the IndexExists service to check if the index "twitter" exists.
	exists, err := client.IndexExists("twitter").Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if exists {
		// ...
	}
}

func ExampleCreateIndexService() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}
	// Create a new index.
	createIndex, err := client.CreateIndex("twitter").Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if !createIndex.Acknowledged {
		// Not acknowledged
	}
}

func ExampleDeleteIndexService() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}
	// Delete an index.
	deleteIndex, err := client.DeleteIndex("twitter").Do()
	if err != nil {
		// Handle error
		panic(err)
	}
	if !deleteIndex.Acknowledged {
		// Not acknowledged
	}
}

func ExampleSearchService() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
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

	// Number of hits
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
}

func ExampleAggregations() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}

	// Create an aggregation for users and a sub-aggregation for a date histogram of tweets (per year).
	timeline := elastic.NewTermsAggregation().Field("user").Size(10).OrderByCountDesc()
	histogram := elastic.NewDateHistogramAggregation().Field("created").Interval("year")
	timeline = timeline.SubAggregation("history", histogram)

	// Search with a term query
	searchResult, err := client.Search().
		Index("twitter").                  // search in index "twitter"
		Query(elastic.NewMatchAllQuery()). // return all results, but ...
		SearchType("count").               // ... do not return hits, just the count
		Aggregation("timeline", timeline). // add our aggregation to the query
		Pretty(true).                      // pretty print request and response JSON
		Do()                               // execute
	if err != nil {
		// Handle error
		panic(err)
	}

	// Access "timeline" aggregate in search result.
	agg, found := searchResult.Aggregations.Terms("timeline")
	if !found {
		log.Fatalf("we sould have a terms aggregation called %q", "timeline")
	}
	for _, userBucket := range agg.Buckets {
		// Every bucket should have the user field as key.
		user := userBucket.Key

		// The sub-aggregation history should have the number of tweets per year.
		histogram, found := userBucket.DateHistogram("history")
		if found {
			for _, year := range histogram.Buckets {
				fmt.Printf("user %q has %d tweets in %q\n", user, year.DocCount, year.KeyAsString)
			}
		}
	}
}

func ExamplePutTemplateService() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Create search template
	tmpl := `{"template":{"query":{"match":{"title":"{{query_string}}"}}}}`

	// Create template
	resp, err := client.PutTemplate().
		Id("my-search-template"). // Name of the template
		BodyString(tmpl).         // Search template itself
		Do()                      // Execute
	if err != nil {
		panic(err)
	}
	if resp.Created {
		fmt.Println("search template created")
	}
}

func ExampleGetTemplateService() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Get template stored under "my-search-template"
	resp, err := client.GetTemplate().Id("my-search-template").Do()
	if err != nil {
		panic(err)
	}
	fmt.Printf("search template is: %q\n", resp.Template)
}

func ExampleDeleteTemplateService() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Delete template
	resp, err := client.DeleteTemplate().Id("my-search-template").Do()
	if err != nil {
		panic(err)
	}
	if resp != nil && resp.Found {
		fmt.Println("template deleted")
	}
}

func ExampleClusterHealthService() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Get cluster health
	res, err := client.ClusterHealth().Index("twitter").Do()
	if err != nil {
		panic(err)
	}
	if res == nil {
		panic(err)
	}
	fmt.Printf("Cluster status is %q\n", res.Status)
}

func ExampleClusterHealthService_WaitForGreen() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Wait for status green
	res, err := client.ClusterHealth().WaitForStatus("green").Timeout("15s").Do()
	if err != nil {
		panic(err)
	}
	if res.TimedOut {
		fmt.Printf("time out waiting for cluster status %q\n", "green")
	} else {
		fmt.Printf("cluster status is %q\n", res.Status)
	}
}

func ExampleClusterStateService() {
	client, err := elastic.NewClient()
	if err != nil {
		panic(err)
	}

	// Get cluster state
	res, err := client.ClusterState().Metric("version").Do()
	if err != nil {
		panic(err)
	}
	fmt.Printf("Cluster %q has version %d", res.ClusterName, res.Version)
}
