package elasticsearch

import (
	"encoding/json"
	"flag"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

var update = flag.Bool("update", true, "update golden files")

func TestResponseParser(t *testing.T) {
	t.Run("Elasticsearch response parser test", func(t *testing.T) {
		t.Run("Simple query and count", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.Len(t, dataframes, 1)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)

			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Count")
		})

		t.Run("Simple query count & avg aggregation", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)

			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Count")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)

			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Average value")
		})

		t.Run("Single group by query one metric", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server1")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server2")
		})

		t.Run("Single group by query two metrics", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 4)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server1 Count")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server1 Average @value")

			frame = dataframes[2]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server2 Count")

			frame = dataframes[3]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server2 Average @value")
		})

		t.Run("With percentiles", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "p75")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "p90")
		})

		t.Run("With extended stats", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 6)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server1 Max")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server1 Std Dev Lower")

			frame = dataframes[2]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server1 Std Dev Upper")

			frame = dataframes[3]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server2 Max")

			frame = dataframes[4]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server2 Std Dev Lower")

			frame = dataframes[5]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "server2 Std Dev Upper")
		})

		t.Run("Single group by with alias pattern", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 3)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server1 Count and {{not_exist}} server1")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "server2 Count and {{not_exist}} server2")

			frame = dataframes[2]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "0 Count and {{not_exist}} 0")
		})

		t.Run("Histogram response", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 1)
		})

		t.Run("With two filters agg", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "@metric:cpu")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "@metric:logins.count")
		})

		t.Run("With drop first and last aggregation (numeric)", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "Average")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "Count")
		})

		t.Run("With drop first and last aggregation (string)", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "avg", "id": "1" }, { "type": "count" }],
          "bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": { "trimEdges": "1" }
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 2)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "Average")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 1)
			assert.Equal(t, frame.Name, "Count")
		})

		t.Run("Larger trimEdges value", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "count" }],
          "bucketAggs": [
						{
							"type": "date_histogram",
							"field": "@timestamp",
							"id": "2",
							"settings": { "trimEdges": "3" }
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
                  { "key": 1000, "doc_count": 10},
                  { "key": 2000, "doc_count": 20},
                  { "key": 3000, "doc_count": 30},
                  { "key": 4000, "doc_count": 40},
                  { "key": 5000, "doc_count": 50},
                  { "key": 6000, "doc_count": 60},
                  { "key": 7000, "doc_count": 70},
                  { "key": 8000, "doc_count": 80},
                  { "key": 9000, "doc_count": 90}
                ]
              }
            }
          }
        ]
			}`
			result, err := parseTestResponse(targets, response)

			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)

			experimental.CheckGoldenJSONResponse(t, "testdata", "trimedges_string.golden", &queryRes, *update)
		})

		t.Run("No group by time", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 1)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 3)
			require.Equal(t, frame.Fields[0].Name, "host")
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, "Average")
			require.Equal(t, frame.Fields[1].Len(), 2)
			require.Equal(t, frame.Fields[2].Name, "Count")
			require.Equal(t, frame.Fields[2].Len(), 2)
			require.Nil(t, frame.Fields[1].Config)
		})

		t.Run("Multiple metrics of same type", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 1)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 3)
			require.Equal(t, frame.Fields[0].Name, "host")
			require.Equal(t, frame.Fields[0].Len(), 1)
			require.Equal(t, frame.Fields[1].Name, "Average test")
			require.Equal(t, frame.Fields[1].Len(), 1)
			require.Equal(t, frame.Fields[2].Name, "Average test2")
			require.Equal(t, frame.Fields[2].Len(), 1)
			require.Nil(t, frame.Fields[1].Config)
		})

		t.Run("With bucket_script", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [
						{ "id": "1", "type": "sum", "field": "@value" },
            { "id": "3", "type": "max", "field": "@value" },
            {
              "id": "4",
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
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 3)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Sum @value")

			frame = dataframes[1]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Max @value")

			frame = dataframes[2]
			require.Len(t, frame.Fields, 2)
			require.Equal(t, frame.Fields[0].Name, data.TimeSeriesTimeFieldName)
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, data.TimeSeriesValueFieldName)
			require.Equal(t, frame.Fields[1].Len(), 2)
			assert.Equal(t, frame.Name, "Sum @value * Max @value")
		})

		t.Run("Terms with two bucket_script", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [
						{ "id": "1", "type": "sum", "field": "@value" },
            			{ "id": "3", "type": "max", "field": "@value" },
            			{
              				"id": "4",
              				"pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
              				"settings": { "script": "params.var1 * params.var2" },
              				"type": "bucket_script"
						},
            			{
							"id": "5",
							"pipelineVariables": [{ "name": "var1", "pipelineAgg": "1" }, { "name": "var2", "pipelineAgg": "3" }],
							"settings": { "script": "params.var1 * params.var2 * 2" },
							"type": "bucket_script"
					  }
					],
          "bucketAggs": [{ "type": "terms", "field": "@timestamp", "id": "2" }]
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
								"5": { "value": 24 },
								"doc_count": 60,
								"key": 1000
							},
							{
								"1": { "value": 3 },
								"3": { "value": 4 },
								"4": { "value": 12 },
								"5": { "value": 48 },
								"doc_count": 60,
								"key": 2000
							}
							]
						}
						}
					}
				]
			}`
			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.NoError(t, err)
			require.Len(t, dataframes, 1)

			frame := dataframes[0]
			require.Len(t, frame.Fields, 5)
			require.Equal(t, frame.Fields[0].Name, "@timestamp")
			require.Equal(t, frame.Fields[0].Len(), 2)
			require.Equal(t, frame.Fields[1].Name, "Sum")
			require.Equal(t, frame.Fields[1].Len(), 2)
			require.Equal(t, frame.Fields[2].Name, "Max")
			require.Equal(t, frame.Fields[2].Len(), 2)
			require.Equal(t, frame.Fields[3].Name, "params.var1 * params.var2")
			require.Equal(t, frame.Fields[3].Len(), 2)
			require.Equal(t, frame.Fields[4].Name, "params.var1 * params.var2 * 2")
			require.Equal(t, frame.Fields[4].Len(), 2)
			require.Nil(t, frame.Fields[1].Config)
		})

		t.Run("Log query", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "logs" }]
				}`,
			}

			response := `{
  			"responses":[
  			  {
  			    "hits":{
  			      "total":{
  			        "value":109,
  			        "relation":"eq"
  			      },
  			      "max_score":null,
  			      "hits":[
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"GB2UMYYBfCQ-FCMjayJa",
  			          "_score":null,
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:55.830Z",
  			            "line":"log text  [479231733]",
  			            "counter":"109",
  			            "float":58.253758485091,
  			            "label":"val1",
  			            "lvl":"info",
  			            "location":"17.089705232090438, 41.62861966340297",
										"nested": {
											"field": {
												"double_nested": "value"
											}
										},
  			            "shapes":[
  			              {
  			                "type":"triangle"
  			              },
  			              {
  			                "type":"square"
  			              }
  			            ],
										"xyz": null
  			          },
  			          "sort":[
  			            1675869055830,
  			            4
  			          ]
  			        },
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
  			          "_score":null,
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:54.835Z",
  			            "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
  			            "counter":"108",
  			            "float":54.5977098233944,
  			            "label":"val1",
  			            "lvl":"info",
  			            "location":"19.766305918490463, 40.42639175509792",
										"nested": {
											"field": {
												"double_nested": "value"
											}
										},
  			            "shapes":[
  			              {
  			                "type":"triangle"
  			              },
  			              {
  			                "type":"square"
  			              }
  			            ],
										"xyz": "def"
  			          },
  			          "sort":[
  			            1675869054835,
  			            7
  			          ]
  			        }
  			      ]
  			    },
  			    "status":200
  			  }
  			]
			}`

			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.Len(t, dataframes, 1)
			frame := dataframes[0]

			require.Equal(t, 16, len(frame.Fields))
			// Fields have the correct length
			require.Equal(t, 2, frame.Fields[0].Len())
			// First field is timeField
			require.Equal(t, data.FieldTypeNullableTime, frame.Fields[0].Type())
			// Second is log line
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[1].Type())
			require.Equal(t, "line", frame.Fields[1].Name)
			// Correctly renames lvl field to level
			require.Equal(t, "level", frame.Fields[10].Name)
			// Correctly uses string types
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[1].Type())
			// Correctly detects float64 types
			require.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[7].Type())
			// Correctly detects json types
			require.Equal(t, data.FieldTypeNullableJSON, frame.Fields[8].Type())
			// Correctly flattens fields
			require.Equal(t, "nested.field.double_nested", frame.Fields[12].Name)
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[12].Type())
			// Correctly detects type even if first value is null
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[15].Type())
		})

		t.Run("Log query with highlight", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "logs" }]
				}`,
			}

			response := `{
  			"responses":[
  			  {
  			    "hits":{
  			      "total":{
  			        "value":109,
  			        "relation":"eq"
  			      },
  			      "max_score":null,
  			      "hits":[
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"GB2UMYYBfCQ-FCMjayJa",
  			          "_score":null,
									"highlight": {
										"line": [
					  					"@HIGHLIGHT@hello@/HIGHLIGHT@, i am a @HIGHLIGHT@message@/HIGHLIGHT@"
										],
										"duplicated": ["@HIGHLIGHT@hello@/HIGHLIGHT@"]
				  				},
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:55.830Z",
  			            "line":"log text  [479231733]"
									}
  			        },
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"GB2UMYYBfCQ-FCMjayJa",
  			          "_score":null,
									"highlight": {
										"line": [
					  					"@HIGHLIGHT@hello@/HIGHLIGHT@, i am a @HIGHLIGHT@message@/HIGHLIGHT@"
										],
										"duplicated": ["@HIGHLIGHT@hello@/HIGHLIGHT@"]
				  				},
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:55.830Z",
  			            "line":"log text  [479231733]"
									}
  			        }
  			      ]
  			    },
  			    "status":200
  			  }
  			]
			}`

			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.Len(t, dataframes, 1)
			frame := dataframes[0]

			customMeta := frame.Meta.Custom

			require.Equal(t, map[string]interface{}{
				"searchWords": []string{"hello", "message"},
			}, customMeta)
		})

		t.Run("Raw document query", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "raw_document" }]
				}`,
			}

			response := `{
  			"responses":[
  			  {
  			    "hits":{
  			      "total":{
  			        "value":109,
  			        "relation":"eq"
  			      },
  			      "max_score":null,
  			      "hits":[
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"GB2UMYYBfCQ-FCMjayJa",
  			          "_score":null,
									"fields": {
										"test_field":"A"
									},
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:55.830Z",
  			            "line":"log text  [479231733]",
  			            "counter":"109",
  			            "float":58.253758485091,
  			            "label":"val1",
  			            "level":"info",
  			            "location":"17.089705232090438, 41.62861966340297",
										"nested": {
											"field": {
												"double_nested": "value"
											}
										}
									}
  			        },
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
  			          "_score":null,
									"fields": {
										"test_field":"A"
									},
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:54.835Z",
  			            "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
  			            "counter":"108",
  			            "float":54.5977098233944,
  			            "label":"val1",
  			            "level":"info",
  			            "location":"19.766305918490463, 40.42639175509792",
										"nested": {
											"field": {
												"double_nested": "value1"
											}
										}
									}
  			        }
  			      ]
  			    },
  			    "status":200
  			  }
  			]
			}`

			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.Len(t, dataframes, 1)
			frame := dataframes[0]

			require.Equal(t, 1, len(frame.Fields))
			//Fields have the correct length
			require.Equal(t, 2, frame.Fields[0].Len())
			// The only field is the raw document
			require.Equal(t, data.FieldTypeNullableJSON, frame.Fields[0].Type())
			require.Equal(t, "A", frame.Fields[0].Name)
		})

		t.Run("Raw data query", func(t *testing.T) {
			targets := map[string]string{
				"A": `{
					"metrics": [{ "type": "raw_data" }]
				}`,
			}

			response := `{
  			"responses":[
  			  {
  			    "hits":{
  			      "total":{
  			        "value":109,
  			        "relation":"eq"
  			      },
  			      "max_score":null,
  			      "hits":[
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"GB2UMYYBfCQ-FCMjayJa",
  			          "_score":null,
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:55.830Z",
  			            "line":"log text  [479231733]",
  			            "counter":"109",
  			            "float":58.253758485091,
  			            "label":"val1",
  			            "level":"info",
  			            "location":"17.089705232090438, 41.62861966340297",
										"nested": {
											"field": {
												"double_nested": "value"
											}
										},
  			            "shapes":[
  			              {
  			                "type":"triangle"
  			              },
  			              {
  			                "type":"square"
  			              }
  			            ],
										"xyz": null
  			          },
  			          "sort":[
  			            1675869055830,
  			            4
  			          ]
  			        },
  			        {
  			          "_index":"logs-2023.02.08",
  			          "_id":"Fx2UMYYBfCQ-FCMjZyJ_",
  			          "_score":null,
  			          "_source":{
  			            "@timestamp":"2023-02-08T15:10:54.835Z",
  			            "line":"log text with ANSI \u001b[31mpart of the text\u001b[0m [493139080]",
  			            "counter":"108",
  			            "float":54.5977098233944,
  			            "label":"val1",
  			            "level":"info",
  			            "location":"19.766305918490463, 40.42639175509792",
										"nested": {
											"field": {
												"double_nested": "value"
											}
										},
  			            "shapes":[
  			              {
  			                "type":"triangle"
  			              },
  			              {
  			                "type":"square"
  			              }
  			            ],
										"xyz": "def"
  			          },
  			          "sort":[
  			            1675869054835,
  			            7
  			          ]
  			        }
  			      ]
  			    },
  			    "status":200
  			  }
  			]
			}`

			result, err := parseTestResponse(targets, response)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			queryRes := result.Responses["A"]
			require.NotNil(t, queryRes)
			dataframes := queryRes.Frames
			require.Len(t, dataframes, 1)
			frame := dataframes[0]

			require.Equal(t, 15, len(frame.Fields))
			// Fields have the correct length
			require.Equal(t, 2, frame.Fields[0].Len())
			// First field is timeField
			require.Equal(t, data.FieldTypeNullableTime, frame.Fields[0].Type())
			// Correctly uses string types
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[1].Type())
			// Correctly detects float64 types
			require.Equal(t, data.FieldTypeNullableFloat64, frame.Fields[5].Type())
			// Correctly detects json types
			require.Equal(t, data.FieldTypeNullableJSON, frame.Fields[6].Type())
			// Correctly flattens fields
			require.Equal(t, "nested.field.double_nested", frame.Fields[11].Name)
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[11].Type())
			// Correctly detects type even if first value is null
			require.Equal(t, data.FieldTypeNullableString, frame.Fields[14].Type())
		})
		t.Run("Raw data query filterable fields", func(t *testing.T) {
			query := []byte(`
				[
					{
						"refId": "A",
						"metrics": [{ "type": "raw_data", "id": "1" }],
						"bucketAggs": []
					}
				]
			`)

			response := []byte(`
				{
					"responses": [
					  {
						"hits": {
						  "total": { "relation": "eq", "value": 1 },
						  "hits": [
							{
							  "_id": "1",
							  "_type": "_doc",
							  "_index": "index",
							  "_source": { "sourceProp": "asd" }
							}
						  ]
						}
					  }
					]
				}
			`)

			result, err := queryDataTest(query, response)
			require.NoError(t, err)

			require.Len(t, result.response.Responses, 1)
			frames := result.response.Responses["A"].Frames
			require.True(t, len(frames) > 0) // FIXME

			for _, field := range frames[0].Fields {
				trueValue := true
				filterableConfig := data.FieldConfig{Filterable: &trueValue}

				// we need to test that the only changed setting is `filterable`
				require.Equal(t, filterableConfig, *field.Config) // FIXME
			}
		})
	})

	t.Run("With top_metrics", func(t *testing.T) {
		targets := map[string]string{
			"A": `{
				"metrics": [
					{
						"type": "top_metrics",
						"settings": {
							"order": "desc",
							"orderBy": "@timestamp",
							"metrics": ["@value", "@anotherValue"]
						},
						"id": "1"
					}
				],
				"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "3" }]
			}`,
		}
		response := `{
			"responses": [{
				"aggregations": {
					"3": {
						"buckets": [
							{
								"key": 1609459200000,
								"key_as_string": "2021-01-01T00:00:00.000Z",
								"1": {
									"top": [
										{ "sort": ["2021-01-01T00:00:00.000Z"], "metrics": { "@value": 1, "@anotherValue": 2 } }
									]
								}
							},
							{
								"key": 1609459210000,
								"key_as_string": "2021-01-01T00:00:10.000Z",
								"1": {
									"top": [
										{ "sort": ["2021-01-01T00:00:10.000Z"], "metrics": { "@value": 1, "@anotherValue": 2 } }
									]
								}
							}
						]
					}
				}
			}]
		}`
		result, err := parseTestResponse(targets, response)
		assert.Nil(t, err)
		assert.Len(t, result.Responses, 1)

		queryRes := result.Responses["A"]
		assert.NotNil(t, queryRes)
		dataframes := queryRes.Frames
		assert.NoError(t, err)
		assert.Len(t, dataframes, 2)

		frame := dataframes[0]
		assert.Len(t, frame.Fields, 2)
		require.Equal(t, frame.Fields[0].Len(), 2)
		require.Equal(t, frame.Fields[1].Len(), 2)
		assert.Equal(t, frame.Name, "Top Metrics @value")
		v, _ := frame.FloatAt(0, 0)
		assert.Equal(t, 1609459200000., v)
		v, _ = frame.FloatAt(1, 0)
		assert.Equal(t, 1., v)

		v, _ = frame.FloatAt(0, 1)
		assert.Equal(t, 1609459210000., v)
		v, _ = frame.FloatAt(1, 1)
		assert.Equal(t, 1., v)

		frame = dataframes[1]
		l, _ := frame.MarshalJSON()
		fmt.Println(string(l))
		assert.Len(t, frame.Fields, 2)
		require.Equal(t, frame.Fields[0].Len(), 2)
		require.Equal(t, frame.Fields[1].Len(), 2)
		assert.Equal(t, frame.Name, "Top Metrics @anotherValue")
		v, _ = frame.FloatAt(0, 0)
		assert.Equal(t, 1609459200000., v)
		v, _ = frame.FloatAt(1, 0)
		assert.Equal(t, 2., v)

		v, _ = frame.FloatAt(0, 1)
		assert.Equal(t, 1609459210000., v)
		v, _ = frame.FloatAt(1, 1)
		assert.Equal(t, 2., v)
	})
}

func parseTestResponse(tsdbQueries map[string]string, responseBody string) (*backend.QueryDataResponse, error) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	configuredFields := es.ConfiguredFields{
		TimeField:       "@timestamp",
		LogMessageField: "line",
		LogLevelField:   "lvl",
	}
	timeRange := backend.TimeRange{
		From: from,
		To:   to,
	}
	tsdbQuery := backend.QueryDataRequest{
		Queries: []backend.DataQuery{},
	}

	for refID, tsdbQueryBody := range tsdbQueries {
		tsdbQuery.Queries = append(tsdbQuery.Queries, backend.DataQuery{
			TimeRange: timeRange,
			RefID:     refID,
			JSON:      json.RawMessage(tsdbQueryBody),
		})
	}

	var response es.MultiSearchResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	queries, err := parseQuery(tsdbQuery.Queries)
	if err != nil {
		return nil, err
	}

	return parseResponse(response.Responses, queries, configuredFields)
}

func TestLabelOrderInFieldName(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "count", "id": "1" }],
		  "bucketAggs": [
			{ "type": "terms", "field": "f1", "id": "3" },
			{ "type": "terms", "field": "f2", "id": "4" },
			{ "type": "date_histogram", "field": "@timestamp", "id": "2" }
		  ]
		}
	  ]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "3": {
				"buckets": [
				  {
					"key": "val3",
					"4": {
					  "buckets": [
						{
						  "key": "info",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 5 }]}
						},
						{
						  "key": "error",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 2 }]}
						}
					  ]
					}
				  },
				  {
					"key": "val2",
					"4": {
					  "buckets": [
						{
						  "key": "info",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 6 }]}
						},
						{
						  "key": "error",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 1 }]}
						}
					  ]
					}
				  },
				  {
					"key": "val1",
					"4": {
					  "buckets": [
						{
						  "key": "info",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 6 }]}
						},
						{
						  "key": "error",
						  "2": {"buckets": [{ "key_as_string": "1675086600000", "key": 1675086600000, "doc_count": 2 }]}
						}
					  ]
					}
				  }
				]
			  }
			}
		  }
		]
	  }
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 6)

	// the important part is that the label-value is always before the level-value
	requireTimeSeriesName(t, "val3 info", frames[0])
	requireTimeSeriesName(t, "val3 error", frames[1])
	requireTimeSeriesName(t, "val2 info", frames[2])
	requireTimeSeriesName(t, "val2 error", frames[3])
	requireTimeSeriesName(t, "val1 info", frames[4])
	requireTimeSeriesName(t, "val1 error", frames[5])
}

func TestFlatten(t *testing.T) {
	t.Run("Flattens simple object", func(t *testing.T) {
		obj := map[string]interface{}{
			"foo": "bar",
			"nested": map[string]interface{}{
				"bax": map[string]interface{}{
					"baz": "qux",
				},
			},
		}

		flattened := flatten(obj)
		require.Len(t, flattened, 2)
		require.Equal(t, "bar", flattened["foo"])
		require.Equal(t, "qux", flattened["nested.bax.baz"])
	})

	t.Run("Flattens object to max 10 nested levels", func(t *testing.T) {
		obj := map[string]interface{}{
			"nested0": map[string]interface{}{
				"nested1": map[string]interface{}{
					"nested2": map[string]interface{}{
						"nested3": map[string]interface{}{
							"nested4": map[string]interface{}{
								"nested5": map[string]interface{}{
									"nested6": map[string]interface{}{
										"nested7": map[string]interface{}{
											"nested8": map[string]interface{}{
												"nested9": map[string]interface{}{
													"nested10": map[string]interface{}{
														"nested11": map[string]interface{}{
															"nested12": "abc",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}

		flattened := flatten(obj)
		require.Len(t, flattened, 1)
		require.Equal(t, map[string]interface{}{"nested11": map[string]interface{}{"nested12": "abc"}}, flattened["nested0.nested1.nested2.nested3.nested4.nested5.nested6.nested7.nested8.nested9.nested10"])
	})
}
