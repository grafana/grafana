package elasticsearch

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
	"reflect"
	"strconv"
	"strings"
	"testing"
)

func testElasticSearchResponse(query Query, expectedElasticSearchRequestJSON string) {
	var queryExpectedJSONInterface, queryJSONInterface interface{}
	jsonDate, _ := simplejson.NewJson([]byte(`{"esVersion":2}`))
	dsInfo := &models.DataSource{
		Database: "grafana-test",
		JsonData: jsonDate,
	}

	testTimeRange := tsdb.NewTimeRange("5m", "now")

	s, err := query.Build(&tsdb.TsdbQuery{TimeRange: testTimeRange}, dsInfo)
	So(err, ShouldBeNil)
	queryJSON := strings.Split(s, "\n")[1]
	err = json.Unmarshal([]byte(queryJSON), &queryJSONInterface)
	So(err, ShouldBeNil)

	expectedElasticSearchRequestJSON = strings.Replace(
		expectedElasticSearchRequestJSON,
		"<FROM_TIMESTAMP>",
		strconv.FormatInt(testTimeRange.GetFromAsMsEpoch(), 10),
		-1,
	)

	expectedElasticSearchRequestJSON = strings.Replace(
		expectedElasticSearchRequestJSON,
		"<TO_TIMESTAMP>",
		strconv.FormatInt(testTimeRange.GetToAsMsEpoch(), 10),
		-1,
	)

	err = json.Unmarshal([]byte(expectedElasticSearchRequestJSON), &queryExpectedJSONInterface)
	So(err, ShouldBeNil)

	result := reflect.DeepEqual(queryExpectedJSONInterface, queryJSONInterface)
	if !result {
		fmt.Printf("ERROR: %s \n !=  \n %s", expectedElasticSearchRequestJSON, queryJSON)
	}
	So(result, ShouldBeTrue)
}
func TestElasticSearchQueryBuilder(t *testing.T) {
	Convey("Elasticsearch QueryBuilder query testing", t, func() {
		Convey("Build test average metric with moving average", func() {
			var expectedElasticsearchQueryJSON = `
			{
				"size": 0,
				"query": {
					"bool": {
					  "filter": [
						{
						  "range": {
							"timestamp": {
							  "gte": "<FROM_TIMESTAMP>",
							  "lte": "<TO_TIMESTAMP>",
							  "format": "epoch_millis"
							}
						  }
						},
						{
						  "query_string": {
							"analyze_wildcard": true,
							"query": "(test:query) AND (name:sample)"
						  }
						}
					  ]
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

			testElasticSearchResponse(avgWithMovingAvg, expectedElasticsearchQueryJSON)
		})
		Convey("Test Wildcards and Quotes", func() {
			expectedElasticsearchQueryJSON := `
			{
				"size": 0,
				"query": {
					"bool": {
						"filter": [
							{
						  		"range": {
									"timestamp": {
								  	"gte": "<FROM_TIMESTAMP>",
									"lte": "<TO_TIMESTAMP>",
									"format": "epoch_millis"
									}
						  		}
							},
							{
						  		"query_string": {
								"analyze_wildcard": true,
								"query": "scope:$location.leagueconnect.api AND name:*CreateRegistration AND name:\"*.201-responses.rate\""
						  	}
						}
					  ]
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
							"format": "epoch_millis",
							"min_doc_count": 0
						}
					}
				}
			}`

			testElasticSearchResponse(wildcardsAndQuotes, expectedElasticsearchQueryJSON)
		})
		Convey("Test Term Aggregates", func() {
			expectedElasticsearchQueryJSON := `
			{
				"size": 0,
				"query": {
					"bool": {
						"filter": [
							{
						  		"range": {
									"timestamp": {
								  	"gte": "<FROM_TIMESTAMP>",
									"lte": "<TO_TIMESTAMP>",
									"format": "epoch_millis"
									}
						  		}
							},
							{
						  		"query_string": {
								"analyze_wildcard": true,
								"query": "(scope:*.hmp.metricsd) AND (name_raw:builtin.general.*_instance_count)"
						  	}
						}
					  ]
					}
				},
				"aggs": {"4":{"aggs":{"2":{"aggs":{"1":{"sum":{"field":"value"}}},"date_histogram":{"extended_bounds":{"max":"<TO_TIMESTAMP>","min":"<FROM_TIMESTAMP>"},"field":"timestamp","format":"epoch_millis","interval":"200ms","min_doc_count":0}}},"terms":{"field":"name_raw","order":{"_term":"desc"},"size":10}}}
			}`

			testElasticSearchResponse(termAggs, expectedElasticsearchQueryJSON)
		})
		Convey("Test Filters Aggregates", func() {
			expectedElasticsearchQueryJSON := `{
			  "size": 0,
			  "query": {
				"bool": {
				  "filter": [
					{
					  "range": {
						"time": {
						  "gte":  "<FROM_TIMESTAMP>",
						  "lte":  "<TO_TIMESTAMP>",
						  "format": "epoch_millis"
						}
					  }
					},
					{
					  "query_string": {
						"analyze_wildcard": true,
						"query": "*"
					  }
					}
				  ]
				}
			  },
			  "aggs": {
				"3": {
				  "filters": {
					"filters": {
					  "hello": {
						"query_string": {
						  "query": "host:\"67.65.185.232\"",
						  "analyze_wildcard": true
						}
					  }
					}
				  },
				  "aggs": {
					"2": {
					  "date_histogram": {
						"interval": "200ms",
						"field": "time",
						"min_doc_count": 0,
						"extended_bounds": {
						  "min":  "<FROM_TIMESTAMP>",
						  "max":  "<TO_TIMESTAMP>"
						},
						"format": "epoch_millis"
					  },
					  "aggs": {}
					}
				  }
				}
			  }
			}
			`

			testElasticSearchResponse(filtersAggs, expectedElasticsearchQueryJSON)
		})
	})
}
