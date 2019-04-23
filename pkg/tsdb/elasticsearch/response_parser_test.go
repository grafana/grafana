package elasticsearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestResponseParser(t *testing.T) {
	Convey("Elasticsearch response parser test", t, func() {
		Convey("Simple query and count", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "doc_count": 10,
                    "key": 1000
                  },
                  {
                    "doc_count": 15,
                    "key": 2000
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 1)
			series := queryRes.Series[0]
			So(series.Name, ShouldEqual, "Count")
			So(series.Points, ShouldHaveLength, 2)
			So(series.Points[0][0].Float64, ShouldEqual, 10)
			So(series.Points[0][1].Float64, ShouldEqual, 1000)
			So(series.Points[1][0].Float64, ShouldEqual, 15)
			So(series.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("Simple query count & avg aggregation", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }, {"type": "avg", "field": "value", "id": "2" }],
          "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "3": {
                "buckets": [
                  {
                    "2": { "value": 88 },
                    "doc_count": 10,
                    "key": 1000
                  },
                  {
                    "2": { "value": 99 },
                    "doc_count": 15,
                    "key": 2000
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 2)
			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "Count")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 10)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 15)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "Average value")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 88)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 99)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("Single group by query one metric", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "3": {
                      "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
                    },
                    "doc_count": 4,
                    "key": "server1"
                  },
                  {
                    "3": {
                      "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
                    },
                    "doc_count": 10,
                    "key": "server2"
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 2)
			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "server1")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 1)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "server2")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 2)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 8)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("Single group by query two metrics", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }, { "type": "avg", "field": "@value", "id": "4" }],
          "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "3": {
                      "buckets": [
                        { "4": { "value": 10 }, "doc_count": 1, "key": 1000 },
                        { "4": { "value": 12 }, "doc_count": 3, "key": 2000 }
                      ]
                    },
                    "doc_count": 4,
                    "key": "server1"
                  },
                  {
                    "3": {
                      "buckets": [
                        { "4": { "value": 20 }, "doc_count": 1, "key": 1000 },
                        { "4": { "value": 32 }, "doc_count": 3, "key": 2000 }
                      ]
                    },
                    "doc_count": 10,
                    "key": "server2"
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 4)
			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "server1 Count")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 1)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "server1 Average @value")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 10)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 12)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)

			seriesThree := queryRes.Series[2]
			So(seriesThree.Name, ShouldEqual, "server2 Count")
			So(seriesThree.Points, ShouldHaveLength, 2)
			So(seriesThree.Points[0][0].Float64, ShouldEqual, 1)
			So(seriesThree.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesThree.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesThree.Points[1][1].Float64, ShouldEqual, 2000)

			seriesFour := queryRes.Series[3]
			So(seriesFour.Name, ShouldEqual, "server2 Average @value")
			So(seriesFour.Points, ShouldHaveLength, 2)
			So(seriesFour.Points[0][0].Float64, ShouldEqual, 20)
			So(seriesFour.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesFour.Points[1][0].Float64, ShouldEqual, 32)
			So(seriesFour.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("With percentiles", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "percentiles", "settings": { "percents": [75, 90] }, "id": "1" }],
          "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "3": {
                "buckets": [
                  {
                    "1": { "values": { "75": 3.3, "90": 5.5 } },
                    "doc_count": 10,
                    "key": 1000
                  },
                  {
                    "1": { "values": { "75": 2.3, "90": 4.5 } },
                    "doc_count": 15,
                    "key": 2000
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 2)
			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "p75")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 3.3)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 2.3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "p90")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 5.5)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 4.5)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("With extended stats", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "extended_stats", "meta": { "max": true, "std_deviation_bounds_upper": true, "std_deviation_bounds_lower": true }, "id": "1" }],
          "bucketAggs": [
						{ "type": "terms", "field": "host", "id": "3" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "4" }
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "3": {
                "buckets": [
                  {
                    "key": "server1",
                    "4": {
                      "buckets": [
                        {
                          "1": {
                            "max": 10.2,
                            "min": 5.5,
                            "std_deviation_bounds": { "upper": 3, "lower": -2 }
                          },
                          "doc_count": 10,
                          "key": 1000
                        }
                      ]
                    }
                  },
                  {
                    "key": "server2",
                    "4": {
                      "buckets": [
                        {
                          "1": {
                            "max": 15.5,
                            "min": 3.4,
                            "std_deviation_bounds": { "upper": 4, "lower": -1 }
                          },
                          "doc_count": 10,
                          "key": 1000
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 6)

			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "server1 Max")
			So(seriesOne.Points, ShouldHaveLength, 1)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 10.2)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "server1 Std Dev Lower")
			So(seriesTwo.Points, ShouldHaveLength, 1)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, -2)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)

			seriesThree := queryRes.Series[2]
			So(seriesThree.Name, ShouldEqual, "server1 Std Dev Upper")
			So(seriesThree.Points, ShouldHaveLength, 1)
			So(seriesThree.Points[0][0].Float64, ShouldEqual, 3)
			So(seriesThree.Points[0][1].Float64, ShouldEqual, 1000)

			seriesFour := queryRes.Series[3]
			So(seriesFour.Name, ShouldEqual, "server2 Max")
			So(seriesFour.Points, ShouldHaveLength, 1)
			So(seriesFour.Points[0][0].Float64, ShouldEqual, 15.5)
			So(seriesFour.Points[0][1].Float64, ShouldEqual, 1000)

			seriesFive := queryRes.Series[4]
			So(seriesFive.Name, ShouldEqual, "server2 Std Dev Lower")
			So(seriesFive.Points, ShouldHaveLength, 1)
			So(seriesFive.Points[0][0].Float64, ShouldEqual, -1)
			So(seriesFive.Points[0][1].Float64, ShouldEqual, 1000)

			seriesSix := queryRes.Series[5]
			So(seriesSix.Name, ShouldEqual, "server2 Std Dev Upper")
			So(seriesSix.Points, ShouldHaveLength, 1)
			So(seriesSix.Points[0][0].Float64, ShouldEqual, 4)
			So(seriesSix.Points[0][1].Float64, ShouldEqual, 1000)
		})

		Convey("Single group by with alias pattern", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"alias": "{{term @host}} {{metric}} and {{not_exist}} {{@host}}",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
						{ "type": "terms", "field": "@host", "id": "2" },
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "3": {
                      "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
                    },
                    "doc_count": 4,
                    "key": "server1"
                  },
                  {
                    "3": {
                      "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
                    },
                    "doc_count": 10,
                    "key": "server2"
                  },
                  {
                    "3": {
                      "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
                    },
                    "doc_count": 10,
                    "key": 0
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 3)

			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "server1 Count and {{not_exist}} server1")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 1)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "server2 Count and {{not_exist}} server2")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 2)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 8)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)

			seriesThree := queryRes.Series[2]
			So(seriesThree.Name, ShouldEqual, "0 Count and {{not_exist}} 0")
			So(seriesThree.Points, ShouldHaveLength, 2)
			So(seriesThree.Points[0][0].Float64, ShouldEqual, 2)
			So(seriesThree.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesThree.Points[1][0].Float64, ShouldEqual, 8)
			So(seriesThree.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("Histogram response", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "3": {
                "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }, { "doc_count": 2, "key": 3000 }]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 3)
			cols := queryRes.Tables[0].Columns
			So(cols, ShouldHaveLength, 2)

			So(cols[0].Text, ShouldEqual, "bytes")
			So(cols[1].Text, ShouldEqual, "Count")

			So(rows[0][0].(null.Float).Float64, ShouldEqual, 1000)
			So(rows[0][1].(null.Float).Float64, ShouldEqual, 1)
			So(rows[1][0].(null.Float).Float64, ShouldEqual, 2000)
			So(rows[1][1].(null.Float).Float64, ShouldEqual, 3)
			So(rows[2][0].(null.Float).Float64, ShouldEqual, 3000)
			So(rows[2][1].(null.Float).Float64, ShouldEqual, 2)
		})

		Convey("With two filters agg", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "count", "id": "1" }],
          "bucketAggs": [
						{
							"type": "filters",
							"id": "2",
							"settings": {
								"filters": [{ "query": "@metric:cpu" }, { "query": "@metric:logins.count" }]
							}
						},
						{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": {
                  "@metric:cpu": {
                    "3": {
                      "buckets": [{ "doc_count": 1, "key": 1000 }, { "doc_count": 3, "key": 2000 }]
                    }
                  },
                  "@metric:logins.count": {
                    "3": {
                      "buckets": [{ "doc_count": 2, "key": 1000 }, { "doc_count": 8, "key": 2000 }]
                    }
                  }
                }
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 2)

			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "@metric:cpu")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 1)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "@metric:logins.count")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 2)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 8)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)
		})

		Convey("With dropfirst and last aggregation", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
          "bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": { "trimEdges": 1 }
						}
					]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "1": { "value": 1000 },
                    "key": 1,
                    "doc_count": 369
                  },
                  {
                    "1": { "value": 2000 },
                    "key": 2,
                    "doc_count": 200
                  },
                  {
                    "1": { "value": 2000 },
                    "key": 3,
                    "doc_count": 200
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 2)

			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "Average")
			So(seriesOne.Points, ShouldHaveLength, 1)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 2000)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 2)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "Count")
			So(seriesTwo.Points, ShouldHaveLength, 1)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 200)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 2)
		})

		Convey("No group by time", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
          "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "1": { "value": 1000 },
                    "key": "server-1",
                    "doc_count": 369
                  },
                  {
                    "1": { "value": 2000 },
                    "key": "server-2",
                    "doc_count": 200
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 2)
			cols := queryRes.Tables[0].Columns
			So(cols, ShouldHaveLength, 3)

			So(cols[0].Text, ShouldEqual, "host")
			So(cols[1].Text, ShouldEqual, "Average")
			So(cols[2].Text, ShouldEqual, "Count")

			So(rows[0][0].(string), ShouldEqual, "server-1")
			So(rows[0][1].(null.Float).Float64, ShouldEqual, 1000)
			So(rows[0][2].(null.Float).Float64, ShouldEqual, 369)
			So(rows[1][0].(string), ShouldEqual, "server-2")
			So(rows[1][1].(null.Float).Float64, ShouldEqual, 2000)
			So(rows[1][2].(null.Float).Float64, ShouldEqual, 200)
		})

		Convey("Multiple metrics of same type", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [{ "type": "avg", "field": "test", "id": "1" }, { "type": "avg", "field": "test2", "id": "2" }],
          "bucketAggs": [{ "type": "terms", "field": "host", "id": "2" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "1": { "value": 1000 },
                    "2": { "value": 3000 },
                    "key": "server-1",
                    "doc_count": 369
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 1)
			cols := queryRes.Tables[0].Columns
			So(cols, ShouldHaveLength, 3)

			So(cols[0].Text, ShouldEqual, "host")
			So(cols[1].Text, ShouldEqual, "Average test")
			So(cols[2].Text, ShouldEqual, "Average test2")

			So(rows[0][0].(string), ShouldEqual, "server-1")
			So(rows[0][1].(null.Float).Float64, ShouldEqual, 1000)
			So(rows[0][2].(null.Float).Float64, ShouldEqual, 3000)
		})

		Convey("With bucket_script", func() {
			targets := map[string]string{
				"A": `{
					"timeField": "@timestamp",
					"metrics": [
						{ "id": "1", "type": "sum", "field": "@value" },
            { "id": "3", "type": "max", "field": "@value" },
            {
              "id": "4",
              "field": "select field",
              "pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
              "settings": { "script": "params.var1 * params.var2" },
              "type": "bucket_script"
            }
					],
          "bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "2" }]
				}`,
			}
			response := `{
        "responses": [
          {
            "aggregations": {
              "2": {
                "buckets": [
                  {
                    "1": { "value": 2 },
                    "3": { "value": 3 },
                    "4": { "value": 6 },
                    "doc_count": 60,
                    "key": 1000
                  },
                  {
                    "1": { "value": 3 },
                    "3": { "value": 4 },
                    "4": { "value": 12 },
                    "doc_count": 60,
                    "key": 2000
                  }
                ]
              }
            }
          }
        ]
			}`
			rp, err := newResponseParserForTest(targets, response)
			So(err, ShouldBeNil)
			result, err := rp.getTimeSeries()
			So(err, ShouldBeNil)
			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Series, ShouldHaveLength, 3)
			seriesOne := queryRes.Series[0]
			So(seriesOne.Name, ShouldEqual, "Sum @value")
			So(seriesOne.Points, ShouldHaveLength, 2)
			So(seriesOne.Points[0][0].Float64, ShouldEqual, 2)
			So(seriesOne.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesOne.Points[1][0].Float64, ShouldEqual, 3)
			So(seriesOne.Points[1][1].Float64, ShouldEqual, 2000)

			seriesTwo := queryRes.Series[1]
			So(seriesTwo.Name, ShouldEqual, "Max @value")
			So(seriesTwo.Points, ShouldHaveLength, 2)
			So(seriesTwo.Points[0][0].Float64, ShouldEqual, 3)
			So(seriesTwo.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesTwo.Points[1][0].Float64, ShouldEqual, 4)
			So(seriesTwo.Points[1][1].Float64, ShouldEqual, 2000)

			seriesThree := queryRes.Series[2]
			So(seriesThree.Name, ShouldEqual, "Sum @value * Max @value")
			So(seriesThree.Points, ShouldHaveLength, 2)
			So(seriesThree.Points[0][0].Float64, ShouldEqual, 6)
			So(seriesThree.Points[0][1].Float64, ShouldEqual, 1000)
			So(seriesThree.Points[1][0].Float64, ShouldEqual, 12)
			So(seriesThree.Points[1][1].Float64, ShouldEqual, 2000)
		})

		// Convey("Raw documents query", func() {
		// 	targets := map[string]string{
		// 		"A": `{
		// 			"timeField": "@timestamp",
		// 			"metrics": [{ "type": "raw_document", "id": "1" }]
		// 		}`,
		// 	}
		// 	response := `{
		//     "responses": [
		//       {
		//         "hits": {
		//           "total": 100,
		//           "hits": [
		//             {
		//               "_id": "1",
		//               "_type": "type",
		//               "_index": "index",
		//               "_source": { "sourceProp": "asd" },
		//               "fields": { "fieldProp": "field" }
		//             },
		//             {
		//               "_source": { "sourceProp": "asd2" },
		//               "fields": { "fieldProp": "field2" }
		//             }
		//           ]
		//         }
		//       }
		//     ]
		// 	}`
		// 	rp, err := newResponseParserForTest(targets, response)
		// 	So(err, ShouldBeNil)
		// 	result, err := rp.getTimeSeries()
		// 	So(err, ShouldBeNil)
		// 	So(result.Results, ShouldHaveLength, 1)

		// 	queryRes := result.Results["A"]
		// 	So(queryRes, ShouldNotBeNil)
		// 	So(queryRes.Tables, ShouldHaveLength, 1)

		// 	rows := queryRes.Tables[0].Rows
		// 	So(rows, ShouldHaveLength, 1)
		// 	cols := queryRes.Tables[0].Columns
		// 	So(cols, ShouldHaveLength, 3)

		// 	So(cols[0].Text, ShouldEqual, "host")
		// 	So(cols[1].Text, ShouldEqual, "Average test")
		// 	So(cols[2].Text, ShouldEqual, "Average test2")

		// 	So(rows[0][0].(string), ShouldEqual, "server-1")
		// 	So(rows[0][1].(null.Float).Float64, ShouldEqual, 1000)
		// 	So(rows[0][2].(null.Float).Float64, ShouldEqual, 3000)
		// })
	})
}

func newResponseParserForTest(tsdbQueries map[string]string, responseBody string) (*responseParser, error) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
	tsdbQuery := &tsdb.TsdbQuery{
		Queries:   []*tsdb.Query{},
		TimeRange: tsdb.NewTimeRange(fromStr, toStr),
	}

	for refID, tsdbQueryBody := range tsdbQueries {
		tsdbQueryJSON, err := simplejson.NewJson([]byte(tsdbQueryBody))
		if err != nil {
			return nil, err
		}

		tsdbQuery.Queries = append(tsdbQuery.Queries, &tsdb.Query{
			Model: tsdbQueryJSON,
			RefId: refID,
		})
	}

	var response es.MultiSearchResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	tsQueryParser := newTimeSeriesQueryParser()
	queries, err := tsQueryParser.parse(tsdbQuery)
	if err != nil {
		return nil, err
	}

	return newResponseParser(response.Responses, queries), nil
}
