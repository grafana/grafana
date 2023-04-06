package elasticsearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func requireTimeValue(t *testing.T, expected int64, frame *data.Frame, index int) {
	getField := func() *data.Field {
		for _, field := range frame.Fields {
			if field.Type() == data.FieldTypeTime {
				return field
			}
		}
		return nil
	}

	field := getField()
	require.NotNil(t, field, "missing time-field")

	require.Equal(t, time.UnixMilli(expected).UTC(), field.At(index), fmt.Sprintf("wrong time at index %v", index))
}

func requireNumberValue(t *testing.T, expected float64, frame *data.Frame, index int) {
	getField := func() *data.Field {
		for _, field := range frame.Fields {
			if field.Type() == data.FieldTypeNullableFloat64 {
				return field
			}
		}
		return nil
	}

	field := getField()
	require.NotNil(t, field, "missing number-field")

	v := field.At(index).(*float64)

	require.Equal(t, expected, *v, fmt.Sprintf("wrong number at index %v", index))
}

func requireFrameLength(t *testing.T, frame *data.Frame, expectedLength int) {
	l, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, expectedLength, l, "wrong frame-length")
}

func requireStringAt(t *testing.T, expected string, field *data.Field, index int) {
	v := field.At(index).(*string)
	require.Equal(t, expected, *v, fmt.Sprintf("wrong string at index %v", index))
}

func requireFloatAt(t *testing.T, expected float64, field *data.Field, index int) {
	v := field.At(index).(*float64)
	require.Equal(t, expected, *v, fmt.Sprintf("wrong flaot at index %v", index))
}

func requireTimeSeriesName(t *testing.T, expected string, frame *data.Frame) {
	require.Equal(t, expected, frame.Name)
}

func TestRefIdMatching(t *testing.T) {
	require.NoError(t, nil)
	query := []byte(`
			[
				{
					"refId": "COUNT_GROUPBY_DATE_HISTOGRAM",
					"metrics": [{ "type": "count", "id": "c_1" }],
					"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "c_2" }]
				},
				{
					"refId": "COUNT_GROUPBY_HISTOGRAM",
					"metrics": [{ "type": "count", "id": "h_3" }],
					"bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "h_4" }]
				},
				{
					"refId": "RAW_DOC",
					"metrics": [{ "type": "raw_document", "id": "r_5" }],
					"bucketAggs": []
				},
				{
					"refId": "PERCENTILE",
					"metrics": [
					{
						"type": "percentiles",
						"settings": { "percents": ["75", "90"] },
						"id": "p_1"
					}
					],
					"bucketAggs": [{ "type": "date_histogram", "field": "@timestamp", "id": "p_3" }]
				},
				{
					"refId": "EXTENDEDSTATS",
					"metrics": [
					{
						"type": "extended_stats",
						"meta": { "max": true, "std_deviation_bounds_upper": true },
						"id": "e_1"
					}
					],
					"bucketAggs": [
					{ "type": "terms", "field": "host", "id": "e_3" },
					{ "type": "date_histogram", "id": "e_4" }
					]
				},
				{
					"refId": "RAWDATA",
					"metrics": [{ "type": "raw_data", "id": "6" }],
					"bucketAggs": []
				}
			]
			`)

	response := []byte(`
			{
				"responses": [
				  {
					"aggregations": {
					  "c_2": {
						"buckets": [{"doc_count": 10, "key": 1000}]
					  }
					}
				  },
				  {
					"aggregations": {
					  "h_4": {
						"buckets": [{ "doc_count": 1, "key": 1000 }]
					  }
					}
				  },
				  {
					"hits": {
					  "total": 2,
					  "hits": [
						{
						  "_id": "5",
						  "_type": "type",
						  "_index": "index",
						  "_source": { "sourceProp": "asd" },
						  "fields": { "fieldProp": "field" }
						},
						{
						  "_source": { "sourceProp": "asd2" },
						  "fields": { "fieldProp": "field2" }
						}
					  ]
					}
				  },
				  {
					"aggregations": {
					  "p_3": {
						"buckets": [
						  {
							"p_1": { "values": { "75": 3.3, "90": 5.5 } },
							"doc_count": 10,
							"key": 1000
						  },
						  {
							"p_1": { "values": { "75": 2.3, "90": 4.5 } },
							"doc_count": 15,
							"key": 2000
						  }
						]
					  }
					}
				  },
				  {
					"aggregations": {
					  "e_3": {
						"buckets": [
						  {
							"key": "server1",
							"e_4": {
							  "buckets": [
								{
								  "e_1": {
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
							"e_4": {
							  "buckets": [
								{
								  "e_1": {
									"max": 10.2,
									"min": 5.5,
									"std_deviation_bounds": { "upper": 3, "lower": -2 }
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
				  },
				  {
					"hits": {
					  "total": {
						"relation": "eq",
						"value": 1
					  },
					  "hits": [
						{
						  "_id": "6",
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

	verifyFrames := func(name string, expectedLength int) {
		r, found := result.response.Responses[name]
		require.True(t, found, "not found: "+name)
		require.NoError(t, r.Error)
		require.Len(t, r.Frames, expectedLength, "length wrong for "+name)
	}

	verifyFrames("COUNT_GROUPBY_DATE_HISTOGRAM", 1)
	verifyFrames("COUNT_GROUPBY_HISTOGRAM", 1)
	verifyFrames("RAW_DOC", 1)
	verifyFrames("PERCENTILE", 2)
	verifyFrames("EXTENDEDSTATS", 4)
	verifyFrames("RAWDATA", 1)
}

func TestSimpleQueryReturns1Frame(t *testing.T) {
	query := []byte(`
		[
			{
				"refId": "A",
				"metrics": [{ "type": "count", "id": "1" }],
				"bucketAggs": [
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
				  "2": {
					"buckets": [
					  { "doc_count": 10, "key": 1000 },
					  { "doc_count": 15, "key": 2000 }
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
	require.Len(t, frames, 1, "frame-count wrong")
	frame := frames[0]
	requireTimeSeriesName(t, "Count", frame)

	requireFrameLength(t, frame, 2)
	requireTimeValue(t, 1000, frame, 0)
	requireNumberValue(t, 10, frame, 0)
}

func TestSimpleQueryCountAndAvg(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{ "type": "count", "id": "1" },
			{ "type": "avg", "field": "value", "id": "2" }
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
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
				  { "2": { "value": 88 }, "doc_count": 10, "key": 1000 },
				  { "2": { "value": 99 }, "doc_count": 15, "key": 2000 }
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
	require.Len(t, frames, 2)

	frame1 := frames[0]
	frame2 := frames[1]

	requireFrameLength(t, frame1, 2)
	requireFrameLength(t, frame2, 2)

	requireTimeValue(t, 1000, frame1, 0)
	requireNumberValue(t, 10, frame1, 0)

	requireTimeSeriesName(t, "Average value", frame2)

	requireNumberValue(t, 88, frame2, 0)
	requireNumberValue(t, 99, frame2, 1)
}

func TestSimpleGroupBy1Metric2Frames(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [{ "type": "count", "id": "1" }],
			"bucketAggs": [
			{ "type": "terms", "field": "host", "id": "2" },
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
			]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": [
				  {
					"3": {
					  "buckets": [
						{ "doc_count": 1, "key": 1000 },
						{ "doc_count": 3, "key": 2000 }
					  ]
					},
					"doc_count": 4,
					"key": "server1"
				  },
				  {
					"3": {
					  "buckets": [
						{ "doc_count": 2, "key": 1000 },
						{ "doc_count": 8, "key": 2000 }
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
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 2)

	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "server1", frames[0])
	requireTimeSeriesName(t, "server2", frames[1])
}

func TestSimpleGroupBy2Metrics4Frames(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "type": "count", "id": "1" },
			{ "type": "avg", "field": "@value", "id": "4" }
		  ],
		  "bucketAggs": [
			{ "type": "terms", "field": "host", "id": "2" },
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
		  ]
		}
	]
	`)

	response := []byte(`
	{
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
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 4)
	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "server1 Count", frames[0])
	requireTimeSeriesName(t, "server1 Average @value", frames[1])
	requireTimeSeriesName(t, "server2 Count", frames[2])
	requireTimeSeriesName(t, "server2 Average @value", frames[3])
}

func TestPercentiles2Frames(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{
				"type": "percentiles",
				"settings": { "percents": ["75", "90"] },
				"id": "1",
				"field": "@value"
			}
			],
			"bucketAggs": [
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
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
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 2)

	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "p75 @value", frames[0])
	requireTimeSeriesName(t, "p90 @value", frames[1])

	requireNumberValue(t, 3.3, frames[0], 0)
	requireTimeValue(t, 1000, frames[0], 0)
	requireNumberValue(t, 4.5, frames[1], 1)
}

func TestExtendedStats4Frames(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{
				"type": "extended_stats",
				"meta": { "max": true, "std_deviation_bounds_upper": true },
				"id": "1",
				"field": "@value"
			}
			],
			"bucketAggs": [
			{ "type": "terms", "field": "host", "id": "3" },
			{ "type": "date_histogram", "id": "4" }
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
					},
					"key": "server1"
				  },
				  {
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
					},
					"key": "server2"
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
	require.Len(t, frames, 4)
	requireFrameLength(t, frames[0], 1)
	requireTimeSeriesName(t, "server1 Max @value", frames[0])
	requireTimeSeriesName(t, "server1 Std Dev Upper @value", frames[1])

	requireNumberValue(t, 10.2, frames[0], 0)
	requireNumberValue(t, 3, frames[1], 0)
}

func TestTopMetrics2Frames(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [
			{
				"type": "top_metrics",
				"settings": {
				"order": "top",
				"orderBy": "@timestamp",
				"metrics": ["@value", "@anotherValue"]
				},
				"id": "1"
			}
			],
			"bucketAggs": [{ "type": "date_histogram", "id": "2" }]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": [
				  {
					"1": {
					  "top": [
						{
						  "sort": ["2021-01-01T00:00:00.000Z"],
						  "metrics": { "@value": 1, "@anotherValue": 2 }
						}
					  ]
					},
					"key": 1609459200000,
					"key_as_string": "2021-01-01T00:00:00.000Z"
				  },
				  {
					"1": {
					  "top": [
						{
						  "sort": ["2021-01-01T00:00:10.000Z"],
						  "metrics": { "@value": 1, "@anotherValue": 2 }
						}
					  ]
					},
					"key": 1609459210000,
					"key_as_string": "2021-01-01T00:00:10.000Z"
				  }
				]
			  }
			}
		  }
		]
	}
	`)

	time1, err := time.Parse(time.RFC3339, "2021-01-01T00:00:00.000Z")
	require.NoError(t, err)
	time2, err := time.Parse(time.RFC3339, "2021-01-01T00:00:10.000Z")
	require.NoError(t, err)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 2)

	frame1 := frames[0]
	frame2 := frames[1]

	requireTimeSeriesName(t, "Top Metrics @value", frame1)
	requireFrameLength(t, frame1, 2)
	requireTimeValue(t, time1.UTC().UnixMilli(), frame1, 0)
	requireTimeValue(t, time2.UTC().UnixMilli(), frame1, 1)
	requireNumberValue(t, 1, frame1, 0)
	requireNumberValue(t, 1, frame1, 1)

	requireTimeSeriesName(t, "Top Metrics @anotherValue", frame2)
	requireFrameLength(t, frame2, 2)
	requireTimeValue(t, time1.UTC().UnixMilli(), frame2, 0)
	requireTimeValue(t, time2.UTC().UnixMilli(), frame2, 1)
	requireNumberValue(t, 2, frame2, 0)
	requireNumberValue(t, 2, frame2, 1)
}

func TestSingleGroupWithAliasPattern3Frames(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "count", "id": "1" }],
		  "alias": "{{term @host}} {{metric}} and {{not_exist}} {{@host}}",
		  "bucketAggs": [
			{ "type": "terms", "field": "@host", "id": "2" },
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
		  ]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": [
				  {
					"3": {
					  "buckets": [
						{ "doc_count": 1, "key": 1000 },
						{ "doc_count": 3, "key": 2000 }
					  ]
					},
					"doc_count": 4,
					"key": "server1"
				  },
				  {
					"3": {
					  "buckets": [
						{ "doc_count": 2, "key": 1000 },
						{ "doc_count": 8, "key": 2000 }
					  ]
					},
					"doc_count": 10,
					"key": "server2"
				  },
				  {
					"3": {
					  "buckets": [
						{ "doc_count": 2, "key": 1000 },
						{ "doc_count": 8, "key": 2000 }
					  ]
					},
					"doc_count": 10,
					"key": 0
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
	require.Len(t, frames, 3)

	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "server1 Count and {{not_exist}} server1", frames[0])
	requireTimeSeriesName(t, "server2 Count and {{not_exist}} server2", frames[1])
	requireTimeSeriesName(t, "0 Count and {{not_exist}} 0", frames[2])
}

func TestHistogramSimple(t *testing.T) {
	query := []byte(`
	[
		{
			"refId": "A",
			"metrics": [{ "type": "count", "id": "1" }],
			"bucketAggs": [{ "type": "histogram", "field": "bytes", "id": "3" }]
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
				  { "doc_count": 1, "key": 1000 },
				  { "doc_count": 3, "key": 2000 },
				  { "doc_count": 2, "key": 1000 }
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
	require.Len(t, frames, 1)
	requireFrameLength(t, frames[0], 3)

	fields := frames[0].Fields
	require.Len(t, fields, 2)

	field1 := fields[0]
	field2 := fields[1]

	require.Equal(t, "bytes", field1.Name)

	trueValue := true
	filterableConfig := data.FieldConfig{Filterable: &trueValue}

	// we need to test that the only changed setting is `filterable`
	require.Equal(t, filterableConfig, *field1.Config)
	require.Equal(t, "Count", field2.Name)
	// we need to test that the fieldConfig is "empty"
	require.Nil(t, field2.Config)
}

func TestHistogramWith2FiltersAgg(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "count", "id": "1" }],
		  "bucketAggs": [
			{
			  "id": "2",
			  "type": "filters",
			  "settings": {
				"filters": [
				  { "query": "@metric:cpu", "label": "" },
				  { "query": "@metric:logins.count", "label": "" }
				]
			  }
			},
			{ "type": "date_histogram", "field": "@timestamp", "id": "3" }
		  ]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": {
				  "@metric:cpu": {
					"3": {
					  "buckets": [
						{ "doc_count": 1, "key": 1000 },
						{ "doc_count": 3, "key": 2000 }
					  ]
					}
				  },
				  "@metric:logins.count": {
					"3": {
					  "buckets": [
						{ "doc_count": 2, "key": 1000 },
						{ "doc_count": 8, "key": 2000 }
					  ]
					}
				  }
				}
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
	require.Len(t, frames, 2)
	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "@metric:cpu", frames[0])
	requireTimeSeriesName(t, "@metric:logins.count", frames[1])
}

func TestTrimEdges(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "type": "avg", "id": "1", "field": "@value" },
			{ "type": "count", "id": "3" }
		  ],
		  "bucketAggs": [
			{
			  "id": "2",
			  "type": "date_histogram",
			  "field": "host",
			  "settings": { "trimEdges": "1" }
			}
		  ]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": [
				  { "1": { "value": 1000 }, "key": 1, "doc_count": 369 },
				  { "1": { "value": 2000 }, "key": 2, "doc_count": 200 },
				  { "1": { "value": 2000 }, "key": 3, "doc_count": 200 }
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
	require.Len(t, frames, 2)

	// should remove first and last value
	requireFrameLength(t, frames[0], 1)
}

func TestTermsAggWithoutDateHistogram(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "type": "avg", "id": "1", "field": "@value" },
			{ "type": "count", "id": "3" }
		  ],
		  "bucketAggs": [{ "id": "2", "type": "terms", "field": "host" }]
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {
			  "2": {
				"buckets": [
				  { "1": { "value": 1000 }, "key": "server-1", "doc_count": 369 },
				  { "1": { "value": 2000 }, "key": "server-2", "doc_count": 200 }
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
	require.Len(t, frames, 1)

	frame1 := frames[0]
	requireFrameLength(t, frame1, 2)
	require.Len(t, frame1.Fields, 3)

	f1 := frame1.Fields[0]
	f2 := frame1.Fields[1]
	f3 := frame1.Fields[2]

	requireStringAt(t, "server-1", f1, 0)
	requireStringAt(t, "server-2", f1, 1)

	requireFloatAt(t, 1000.0, f2, 0)
	requireFloatAt(t, 2000.0, f2, 1)

	requireFloatAt(t, 369.0, f3, 0)
	requireFloatAt(t, 200.0, f3, 1)
}

func TestPercentilesWithoutDateHistogram(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{
			  "type": "percentiles",
			  "field": "value",
			  "settings": { "percents": ["75", "90"] },
			  "id": "1"
			}
		  ],
		  "bucketAggs": [{ "type": "terms", "field": "id", "id": "3" }]
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
					"1": { "values": { "90": 5.5, "75": 3.3 } },
					"doc_count": 10,
					"key": "id1"
				  },
				  {
					"1": { "values": { "75": 2.3, "90": 4.5 } },
					"doc_count": 15,
					"key": "id2"
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
	require.Len(t, frames, 1)
	requireFrameLength(t, frames[0], 2)

	require.Len(t, frames[0].Fields, 3)

	f1 := frames[0].Fields[0]
	f2 := frames[0].Fields[1]
	f3 := frames[0].Fields[2]

	require.Equal(t, "id", f1.Name)
	require.Equal(t, "p75 value", f2.Name)
	require.Equal(t, "p90 value", f3.Name)

	requireStringAt(t, "id1", f1, 0)
	requireStringAt(t, "id2", f1, 1)

	requireFloatAt(t, 3.3, f2, 0)
	requireFloatAt(t, 2.3, f2, 1)

	requireFloatAt(t, 5.5, f3, 0)
	requireFloatAt(t, 4.5, f3, 1)
}

func TestMultipleMetricsOfTheSameType(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "type": "avg", "id": "1", "field": "test" },
			{ "type": "avg", "id": "2", "field": "test2" }
		  ],
		  "bucketAggs": [{ "id": "2", "type": "terms", "field": "host" }]
		}
	]
	`)

	response := []byte(`
	{
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
	  }
		  
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.True(t, len(frames) > 0)
	requireFrameLength(t, frames[0], 1)
	require.Len(t, frames[0].Fields, 3)

	requireStringAt(t, "server-1", frames[0].Fields[0], 0)
	requireFloatAt(t, 1000.0, frames[0].Fields[1], 0)
	requireFloatAt(t, 3000.0, frames[0].Fields[2], 0)
}

func TestRawDocumentQuery(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "raw_document", "id": "1" }],
		  "bucketAggs": []
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
			{
			"hits": {
				"total": 100,
				"hits": [
				{
					"_id": "1",
					"_type": "type",
					"_index": "index",
					"_source": { "sourceProp": "asd" },
					"fields": { "fieldProp": "field" }
				},
				{
					"_source": { "sourceProp": "asd2" },
					"fields": { "fieldProp": "field2" }
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
	require.Len(t, frames, 1)
	fields := frames[0].Fields

	require.Len(t, fields, 1)
	f := fields[0]

	require.Equal(t, data.FieldTypeNullableJSON, f.Type())
	require.Equal(t, 2, f.Len())

	v := f.At(0).(*json.RawMessage)
	var jsonData map[string]interface{}
	err = json.Unmarshal(*v, &jsonData)
	require.NoError(t, err)

	require.Equal(t, "asd", jsonData["sourceProp"])
	require.Equal(t, "field", jsonData["fieldProp"])
}

func TestBucketScript(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "id": "1", "type": "sum", "field": "@value" },
			{ "id": "3", "type": "max", "field": "@value" },
			{
			  "id": "4",
			  "pipelineVariables": [
				{ "name": "var1", "pipelineAgg": "1" },
				{ "name": "var2", "pipelineAgg": "3" }
			  ],
			  "settings": { "script": "params.var1 * params.var2" },
			  "type": "bucket_script"
			}
		  ],
		  "bucketAggs": [
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
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 3)
	requireFrameLength(t, frames[0], 2)
	requireTimeSeriesName(t, "Sum @value", frames[0])
	requireTimeSeriesName(t, "Max @value", frames[1])
	requireTimeSeriesName(t, "Sum @value * Max @value", frames[2])

	requireNumberValue(t, 2, frames[0], 0)
	requireNumberValue(t, 3, frames[1], 0)
	requireNumberValue(t, 6, frames[2], 0)

	requireNumberValue(t, 3, frames[0], 1)
	requireNumberValue(t, 4, frames[1], 1)
	requireNumberValue(t, 12, frames[2], 1)
}

func TestTwoBucketScripts(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [
			{ "id": "1", "type": "sum", "field": "@value" },
			{ "id": "3", "type": "max", "field": "@value" },
			{
			  "id": "4",
			  "pipelineVariables": [
				{ "name": "var1", "pipelineAgg": "1" },
				{ "name": "var2", "pipelineAgg": "3" }
			  ],
			  "settings": { "script": "params.var1 * params.var2" },
			  "type": "bucket_script"
			},
			{
			  "id": "5",
			  "pipelineVariables": [
				{ "name": "var1", "pipelineAgg": "1" },
				{ "name": "var2", "pipelineAgg": "3" }
			  ],
			  "settings": { "script": "params.var1 * params.var2 * 4" },
			  "type": "bucket_script"
			}
		  ],
		  "bucketAggs": [{ "type": "terms", "field": "@timestamp", "id": "2" }]
		}
	]
	`)

	response := []byte(`
	{
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
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.True(t, len(frames) > 0)
	requireFrameLength(t, frames[0], 2)

	fields := frames[0].Fields
	require.Len(t, fields, 5)

	requireFloatAt(t, 1000.0, fields[0], 0)
	requireFloatAt(t, 2000.0, fields[0], 1)
	requireFloatAt(t, 2.0, fields[1], 0)
	requireFloatAt(t, 3.0, fields[1], 1)
	requireFloatAt(t, 3.0, fields[2], 0)
	requireFloatAt(t, 4.0, fields[2], 1)
	requireFloatAt(t, 6.0, fields[3], 0)
	requireFloatAt(t, 12.0, fields[3], 1)
	requireFloatAt(t, 24.0, fields[4], 0)
	requireFloatAt(t, 48.0, fields[4], 1)
}

func TestLogs(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "logs"}],
		  "bucketAggs": [
			{
			  "type": "date_histogram",
			  "settings": { "interval": "auto" },
			  "id": "2"
			}
		  ],
		  "key": "Q-1561369883389-0.7611823271062786-0",
		  "query": "hello AND message"
		}
	]
`)

	response := []byte(`
	{
		"responses": [
		  {
			"aggregations": {},
			"hits": {
			  "hits": [
				{
				  "_id": "fdsfs",
				  "_type": "_doc",
				  "_index": "mock-index",
				  "_source": {
					"testtime": "2019-06-24T09:51:19.765Z",
					"host": "djisaodjsoad",
					"number": 1,
					"line": "hello, i am a message",
					"level": "debug",
					"fields": { "lvl": "debug" }
				  },
				  "highlight": {
					"message": [
					  "@HIGHLIGHT@hello@/HIGHLIGHT@, i am a @HIGHLIGHT@message@/HIGHLIGHT@"
					]
				  }
				},
				{
				  "_id": "kdospaidopa",
				  "_type": "_doc",
				  "_index": "mock-index",
				  "_source": {
					"testtime": "2019-06-24T09:52:19.765Z",
					"host": "dsalkdakdop",
					"number": 2,
					"line": "hello, i am also message",
					"level": "error",
					"fields": { "lvl": "info" }
				  },
				  "highlight": {
					"message": [
					  "@HIGHLIGHT@hello@/HIGHLIGHT@, i am a @HIGHLIGHT@message@/HIGHLIGHT@"
					]
				  }
				}
			  ]
			}
		  }
		]
	}
`)

	t.Run("response", func(t *testing.T) {
		result, err := queryDataTest(query, response)
		require.NoError(t, err)

		require.Len(t, result.response.Responses, 1)
		frames := result.response.Responses["A"].Frames
		require.Len(t, frames, 1)

		logsFrame := frames[0]

		meta := logsFrame.Meta
		require.Equal(t, map[string]interface{}{"searchWords": []string{"hello", "message"}}, meta.Custom)
		require.Equal(t, data.VisTypeLogs, string(meta.PreferredVisualization))

		logsFieldMap := make(map[string]*data.Field)
		for _, field := range logsFrame.Fields {
			logsFieldMap[field.Name] = field
		}

		require.Contains(t, logsFieldMap, "testtime")
		require.Equal(t, data.FieldTypeNullableTime, logsFieldMap["testtime"].Type())

		require.Contains(t, logsFieldMap, "host")
		require.Equal(t, data.FieldTypeNullableString, logsFieldMap["host"].Type())

		require.Contains(t, logsFieldMap, "line")
		require.Equal(t, data.FieldTypeNullableString, logsFieldMap["line"].Type())

		require.Contains(t, logsFieldMap, "number")
		require.Equal(t, data.FieldTypeNullableFloat64, logsFieldMap["number"].Type())

		require.Contains(t, logsFieldMap, "_source")
		require.Equal(t, data.FieldTypeNullableJSON, logsFieldMap["_source"].Type())

		requireStringAt(t, "fdsfs", logsFieldMap["_id"], 0)
		requireStringAt(t, "kdospaidopa", logsFieldMap["_id"], 1)
		requireStringAt(t, "_doc", logsFieldMap["_type"], 0)
		requireStringAt(t, "_doc", logsFieldMap["_type"], 1)
		requireStringAt(t, "mock-index", logsFieldMap["_index"], 0)
		requireStringAt(t, "mock-index", logsFieldMap["_index"], 1)

		actualJson1, err := json.Marshal(logsFieldMap["_source"].At(0).(*json.RawMessage))
		require.NoError(t, err)
		actualJson2, err := json.Marshal(logsFieldMap["_source"].At(1).(*json.RawMessage))
		require.NoError(t, err)

		expectedJson1 := `
		{
			"fields.lvl": "debug",
			"host": "djisaodjsoad",
			"level": "debug",
			"line": "hello, i am a message",
			"number": 1,
			"testtime": "2019-06-24T09:51:19.765Z",
			"line": "hello, i am a message"
		}
		`

		expectedJson2 := `
		{
			"testtime": "2019-06-24T09:52:19.765Z",
			"host": "dsalkdakdop",
			"number": 2,
			"line": "hello, i am also message",
			"level": "error",
			"fields.lvl": "info"
		}`

		require.JSONEq(t, expectedJson1, string(actualJson1))
		require.JSONEq(t, expectedJson2, string(actualJson2))
	})

	t.Run("level field", func(t *testing.T) {
		result, err := queryDataTest(query, response)
		require.NoError(t, err)

		require.Len(t, result.response.Responses, 1)
		frames := result.response.Responses["A"].Frames
		require.True(t, len(frames) > 0)

		requireFrameLength(t, frames[0], 2)
		fieldMap := make(map[string]*data.Field)
		for _, field := range frames[0].Fields {
			fieldMap[field.Name] = field
		}

		require.Contains(t, fieldMap, "level")
		field := fieldMap["level"]

		requireStringAt(t, "debug", field, 0)
		requireStringAt(t, "error", field, 1)
	})
}

func TestLogsEmptyResponse(t *testing.T) {
	query := []byte(`
	[
		{
		  "refId": "A",
		  "metrics": [{ "type": "logs", "id": "2" }],
		  "bucketAggs": [],
		  "key": "Q-1561369883389-0.7611823271062786-0",
		  "query": "hello AND message"
		}
	]
	`)

	response := []byte(`
	{
		"responses": [
		  {
			"hits": { "hits": [] },
			"aggregations": {},
			"status": 200
		  }
		]
	}
	`)

	result, err := queryDataTest(query, response)
	require.NoError(t, err)

	require.Len(t, result.response.Responses, 1)
	frames := result.response.Responses["A"].Frames
	require.Len(t, frames, 1)
}
