package elasticsearch

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func testElasticSearchResponse(requestJSON string, expectedElasticSearchRequestJSON string) {
	model := &RequestModel{}

	err := json.Unmarshal([]byte(requestJSON), model)
	So(err, ShouldBeNil)

	testTimeRange := &tsdb.TimeRange{
		From: "5m",
		To:   "now",
		Now:  time.Now(),
	}

	queryJSON, err := model.buildQueryJSON(testTimeRange)
	So(err, ShouldBeNil)

	var queryExpectedJSONInterface, queryJSONInterface interface{}

	err = json.Unmarshal([]byte(queryJSON), &queryJSONInterface)
	So(err, ShouldBeNil)

	expectedElasticSearchRequestJSON = strings.Replace(
		expectedElasticSearchRequestJSON,
		"<FROM_TIMESTAMP>",
		convertTimeToUnixNano(testTimeRange.From, testTimeRange.Now),
		-1,
	)

	expectedElasticSearchRequestJSON = strings.Replace(
		expectedElasticSearchRequestJSON,
		"<TO_TIMESTAMP>",
		convertTimeToUnixNano(testTimeRange.To, testTimeRange.Now),
		-1,
	)

	err = json.Unmarshal([]byte(expectedElasticSearchRequestJSON), &queryExpectedJSONInterface)
	So(err, ShouldBeNil)

	result := reflect.DeepEqual(queryExpectedJSONInterface, queryJSONInterface)
	if !result {
		fmt.Printf("ERROR: \n%#v \n!= \n%#v", expectedElasticSearchRequestJSON, queryJSON)
	}
	So(result, ShouldBeTrue)

}

func TestElasticSearchQueryBuilder(t *testing.T) {
	Convey("Elasticsearch QueryBuilder query testing", t, func() {

		Convey("Build test average metric with moving average", func() {
			var testElasticsearchModelRequestJSON = `
			{
				"bucketAggs": [
					{
						"field": "timestamp",
						"id": "2",
						"settings": {
							"interval": "auto",
							"min_doc_count": 0,
							"trimEdges": 0
						},
						"type": "date_histogram"
					}
				],
				"dsType": "elasticsearch",
				"metrics": [
					{
						"field": "value",
						"id": "1",
						"inlineScript": "_value * 2",
						"meta": {},
						"settings": {
							"script": {
								"inline": "_value * 2"
							}
						},
						"type": "avg"
					},
					{
						"field": "1",
						"id": "3",
						"meta": {},
						"pipelineAgg": "1",
						"settings": {
							"minimize": false,
							"model": "simple",
							"window": 5
						},
						"type": "moving_avg"
					}
				],
				"query": "(test:query) AND (name:sample)",
				"refId": "A",
				"timeField": "timestamp"
			}
			`

			var expectedElasticsearchQueryJSON = `
			{
				"size": 0,
				"query": {
					"filtered": {
						"query": {
							"query_string": {
								"analyze_wildcard": true,
								"query": "(test:query) AND (name:sample)"
							}
						},
						"filter": {
							"bool": {
								"must": [
									{
										"range": {
											"timestamp": {
												"gte": "<FROM_TIMESTAMP>",
												"lte": "<TO_TIMESTAMP>",
												"format": "epoch_millis"
											}
										}
									}
								]
							}
						}
					}
				},
				"aggs": {
					"2": {
						"date_histogram": {
							"interval": "200ms",
							"field": "timestamp",
							"min_doc_count": 0,
							"extended_bounds": {
								"min": "<FROM_TIMESTAMP>",
								"max": "<TO_TIMESTAMP>"
							},
							"format": "epoch_millis"
						},
						"aggs": {
							"1": {
								"avg": {
									"field": "value",
									"script": {
										"inline": "_value * 2"
									}
								}
							},
							"3": {
								"moving_avg": {
									"buckets_path": "1",
									"window": 5,
									"model": "simple",
									"minimize": false
								}
							}
						}
					}
				}
			}`

			testElasticSearchResponse(testElasticsearchModelRequestJSON, expectedElasticsearchQueryJSON)
		})

		Convey("Test Wildcards and Quotes", func() {
			testElasticsearchModelRequestJSON := `
			{
				"alias": "New",
				"bucketAggs": [
					{
						"field": "timestamp",
						"id": "2",
						"type": "date_histogram"
					}
				],
				"dsType": "elasticsearch",
				"metrics": [
					{
						"type": "sum",
						"field": "value",
						"id": "1"
					}
				],
				"query": "scope:$location.leagueconnect.api AND name:*CreateRegistration AND name:\"*.201-responses.rate\"",
				"refId": "A",
				"timeField": "timestamp"
			}`

			expectedElasticsearchQueryJSON := `
			{
				"size": 0,
				"query": {
					"filtered": {
						"query": {
							"query_string": {
								"analyze_wildcard": true,
								"query": "scope:$location.leagueconnect.api AND name:*CreateRegistration AND name:\"*.201-responses.rate\""
							}
						},
						"filter": {
							"bool": {
								"must": [
									{
										"range": {
											"timestamp": {
												"gte": "<FROM_TIMESTAMP>",
												"lte": "<TO_TIMESTAMP>",
												"format": "epoch_millis"
											}
										}
									}
								]
							}
						}
					}
				},
				"aggs": {
					"2": {
						"aggs": {
							"1": {
								"sum": {
									"field": "value"
								}
							}
						},
						"date_histogram": {
							"extended_bounds": {
								"max": "<TO_TIMESTAMP>",
								"min": "<FROM_TIMESTAMP>"
							},
							"field": "timestamp",
							"format": "epoch_millis"
						}
					}
				}
			}`

			testElasticSearchResponse(testElasticsearchModelRequestJSON, expectedElasticsearchQueryJSON)
		})
		Convey("Test Term Aggregates", func() {
			testElasticsearchModelRequestJSON := `
			{
				"bucketAggs": [{
					"field": "name_raw",
					"id": "4",
					"settings": {
						"order": "desc",
						"orderBy": "_term",
						"size": "10"
					},
					"type": "terms"
				}, {
					"field": "timestamp",
					"id": "2",
					"settings": {
						"interval": "1m",
						"min_doc_count": 0,
						"trimEdges": 0
					},
					"type": "date_histogram"
				}],
				"dsType": "elasticsearch",
				"filters": [{
					"boolOp": "AND",
					"not": false,
					"type": "rfc190Scope",
					"value": "*.hmp.metricsd"
				}, {
					"boolOp": "AND",
					"not": false,
					"type": "name_raw",
					"value": "builtin.general.*_instance_count"
				}],
				"metricObject": {},
				"metrics": [{
					"field": "value",
					"id": "1",
					"meta": {},
					"options": {},
					"settings": {},
					"type": "sum"
				}],
				"mode": 0,
				"numToGraph": 10,
				"prependHostName": false,
				"query": "(scope:*.hmp.metricsd) AND (name_raw:builtin.general.*_instance_count)",
				"refId": "A",
				"regexAlias": false,
				"selectedApplication": "",
				"selectedHost": "",
				"selectedLocation": "",
				"timeField": "timestamp",
				"useFullHostName": "",
				"useQuery": false
			}`

			expectedElasticsearchQueryJSON := `
			{
				"size": 0,
				"query": {
					"filtered": {
						"query": {
							"query_string": {
								"analyze_wildcard": true,
								"query": "(scope:*.hmp.metricsd) AND (name_raw:builtin.general.*_instance_count)"
							}
						},
						"filter": {
							"bool": {
								"must": [
									{
										"range":
			          		{
			          			"timestamp": {
			          				"gte":"<FROM_TIMESTAMP>",
			          				"lte":"<TO_TIMESTAMP>",
			          				"format":"epoch_millis"
			          			}
			          		}
									}
								]
							}
						}
					}
				},
				"aggs": {"4":{"aggs":{"2":{"aggs":{"1":{"sum":{"field":"value"}}},"date_histogram":{"extended_bounds":{"max":"<TO_TIMESTAMP>","min":"<FROM_TIMESTAMP>"},"field":"timestamp","format":"epoch_millis","interval":"1m","min_doc_count":0}}},"terms":{"field":"name_raw","order":{"_term":"desc"},"size":10}}}
			}`

			testElasticSearchResponse(testElasticsearchModelRequestJSON, expectedElasticsearchQueryJSON)
		})
	})
}
