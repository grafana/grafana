package influxdb

import (
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func prepare(text string) io.ReadCloser {
	return io.NopCloser(strings.NewReader(text))
}

func addQueryToQueries(query Query) []Query {
	var queries []Query
	query.RefID = "A"
	query.RawQuery = "Test raw query"
	queries = append(queries, query)
	return queries
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should handle invalid JSON", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `{ invalid }`

		query := &Query{}

		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		require.Nil(t, result.Responses["A"].Frames)
		require.Error(t, result.Responses["A"].Error)
	})

	t.Run("Influxdb response parser should parse everything normally including nil bools and nil strings", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"columns": ["time","mean","path","isActive"],
							"tags": {"datacenter": "America"},
							"values": [
								[111,222,null,null],
								[111,222,"/usr/path",false],
								[111,null,"/usr/path",true]
							]
						}
					]
				}
			]
		}
		`

		query := &Query{}
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)

		floatField := data.NewField("value", labels, []*float64{
			util.Pointer(222.0), util.Pointer(222.0), nil,
		})
		floatField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		floatFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			floatField,
		)
		floatFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		string_test := "/usr/path"
		stringField := data.NewField("value", labels, []*string{
			nil, &string_test, &string_test,
		})
		stringField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.path { datacenter: America }"}
		stringFrame := data.NewFrame("cpu.path { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			stringField,
		)
		stringFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		bool_true := true
		bool_false := false
		boolField := data.NewField("value", labels, []*bool{
			nil, &bool_false, &bool_true,
		})
		boolField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.isActive { datacenter: America }"}
		boolFrame := data.NewFrame("cpu.isActive { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			boolField,
		)
		boolFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		frame := result.Responses["A"]
		if diff := cmp.Diff(floatFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff(stringFrame, frame.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff(boolFrame, frame.Frames[2], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse metricFindQueries normally", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"refId": "metricFindQuery",
							"name": "cpu",
							"values": [
								["cpu"],
								["disk"],
								["logs"]
							]
						}
					]
				}
			]
		}
		`

		var queries []Query
		queries = append(queries, Query{RefID: "metricFindQuery"})
		newField := data.NewField("value", nil, []string{
			"cpu", "disk", "logs",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := parser.Parse(prepare(response), queries)

		frame := result.Responses["metricFindQuery"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse metricFindQueries->SHOW TAG VALUES normally", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"values": [
								["values", "cpu-total"],
								["values", "cpu0"],
								["values", "cpu1"]
							]
						}
					]
				}
			]
		}
		`

		var queries []Query
		queries = append(queries, Query{RawQuery: "SHOW TAG VALUES", RefID: "metricFindQuery"})
		newField := data.NewField("value", nil, []string{
			"cpu-total", "cpu0", "cpu1",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := parser.Parse(prepare(response), queries)

		frame := result.Responses["metricFindQuery"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse two responses with different refIDs", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [{}]
				},
				{
					"series": [{}]
				}
			]
		}
		`

		query := &Query{}
		var queries = addQueryToQueries(*query)
		queryB := &Query{}
		queryB.RefID = "B"
		queries = append(queries, *queryB)
		result := parser.Parse(prepare(response), queries)

		assert.Len(t, result.Responses, 2)
		assert.Contains(t, result.Responses, "A")
		assert.Contains(t, result.Responses, "B")
		assert.NotContains(t, result.Responses, "C")
	})

	t.Run("Influxdb response parser populates the RawQuery in the response meta ExecutedQueryString", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"columns": ["time","cpu"],
							"values": [
								["values", "cpu-total"],
								["values", "cpu0"],
								["values", "cpu1"]
							]
						}
					]
				}
			]
		}
		`

		query := &Query{}
		query.RawQuery = "Test raw query"
		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		frame := result.Responses["A"]
		assert.Equal(t, frame.Frames[0].Meta.ExecutedQueryString, "Test raw query")
	})

	t.Run("Influxdb response parser with invalid value-format", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"columns": ["time","mean"],
							"values": [
								[100,50],
								[101,"hello"],
								[102,52]
							]
						}
					]
				}
			]
		}
		`

		query := &Query{}

		newField := data.NewField("value", nil, []*float64{
			util.Pointer(50.0), nil, util.Pointer(52.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		frame := result.Responses["A"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with invalid timestamp-format", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"columns": ["time","mean"],
							"values": [
								[100,50],
								["hello",51],
								["hello","hello"],
								[102,52]
							]
						}
					]
				}
			]
		}
		`

		query := &Query{}

		newField := data.NewField("value", nil, []*float64{
			util.Pointer(50.0), util.Pointer(52.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		frame := result.Responses["A"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu.upc",
							"columns": ["time","mean","sum"],
							"tags": {
								"datacenter": "America",
								"dc.region.name": "Northeast",
								"cluster-name":   "Cluster",
								"/cluster/name/": "Cluster/",
								"@cluster@name@": "Cluster@"
							},
							"values": [
								[111,222,333]
							]
						}
					]
				}
			]
		}
		`

		query := &Query{Alias: "series alias"}
		labels, err := data.LabelsFromString("/cluster/name/=Cluster/, @cluster@name@=Cluster@, cluster-name=Cluster, datacenter=America, dc.region.name=Northeast")
		require.Nil(t, err)
		newField := data.NewField("value", labels, []*float64{
			util.Pointer(222.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "series alias"}
		testFrame := data.NewFrame("series alias",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
		result := parser.Parse(prepare(response), addQueryToQueries(*query))
		t.Run("should parse aliases", func(t *testing.T) {
			frame := result.Responses["A"]
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $m $measurement", Measurement: "10m"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))

			frame = result.Responses["A"]
			name := "alias 10m 10m"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $col", Measurement: "10m"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
			name = "alias sum"
			testFrame.Name = name
			newField = data.NewField("value", labels, []*float64{
				util.Pointer(333.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $tag_datacenter"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias America"
			testFrame.Name = name
			newField = data.NewField("value", labels, []*float64{
				util.Pointer(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $tag_datacenter/$tag_datacenter"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias America/America"
			testFrame.Name = name
			newField = data.NewField("value", labels, []*float64{
				util.Pointer(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[col]]", Measurement: "10m"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $0 $1 $2 $3 $4"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias cpu upc $2 $3 $4"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $0, $1 - $2 - $3, $4: something"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias cpu, upc - $2 - $3, $4: something"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $1"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $5"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias $5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "series alias"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "series alias"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias 10m 10m"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_datacenter]]"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias America"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_dc.region.name]]"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Northeast"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_cluster-name]]"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Cluster"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_/cluster/name/]]"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Cluster/"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_@cluster@name@]]"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Cluster@"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
		t.Run("shouldn't parse aliases", func(t *testing.T) {
			query = &Query{Alias: "alias words with no brackets"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame := result.Responses["A"]
			name := "alias words with no brackets"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias Test 1.5"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Test 1.5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias Test -1"}
			result = parser.Parse(prepare(response), addQueryToQueries(*query))
			frame = result.Responses["A"]
			name = "alias Test -1"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu",
							"columns": ["time","mean","sum"],
							"tags": {"datacenter": "America"},
							"values": [
								[111,222,333],
								[111,222,333],
								[111,null,333]
							]
						}
					]
				},
				{
					"error": "query-timeout limit exceeded"
				}
			]
		}
		`

		query := &Query{}
		var queries = addQueryToQueries(*query)
		queryB := &Query{}
		queryB.RefID = "B"
		queries = append(queries, *queryB)
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)
		newField := data.NewField("value", labels, []*float64{
			util.Pointer(222.0), util.Pointer(222.0), nil,
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		testFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
		result := parser.Parse(prepare(response), queries)

		frame := result.Responses["A"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		require.EqualError(t, result.Responses["B"].Error, "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"error": "error parsing query: found THING"
		}
		`

		query := &Query{}

		result := parser.Parse(prepare(response), addQueryToQueries(*query))

		require.Nil(t, result.Responses["A"].Frames)

		require.EqualError(t, result.Responses["A"].Error, "error parsing query: found THING")
	})

	t.Run("Influxdb response parser parseNumber nil", func(t *testing.T) {
		value := parseNumber(nil)
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseNumber valid JSON.number", func(t *testing.T) {
		value := parseNumber(json.Number("95.4"))
		require.Equal(t, *value, 95.4)
	})

	t.Run("Influxdb response parser parseNumber invalid type", func(t *testing.T) {
		value := parseNumber("95.4")
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseTimestamp valid JSON.number", func(t *testing.T) {
		// currently we use milliseconds-precision with influxdb, so the test works with that.
		// if we change this to for example nanoseconds-precision, the tests will have to change.
		timestamp, err := parseTimestamp(json.Number("1609556645000"))
		require.NoError(t, err)
		require.Equal(t, timestamp.Format(time.RFC3339), "2021-01-02T03:04:05Z")
	})

	t.Run("Influxdb response parser parseNumber invalid type", func(t *testing.T) {
		_, err := parseTimestamp("hello")
		require.Error(t, err)
	})
}

func TestResponseParser_Parse(t *testing.T) {
	tests := []struct {
		name  string
		input string
		f     func(t *testing.T, got *backend.QueryDataResponse)
	}{
		{
			name: "Influxdb response parser with valid value when null values returned",
			input: `{ "results": [ { "series": [ {
				"name": "cpu",
				"columns": ["time","mean"],
				"values": [
					[100,null],
					[101,null],
					[102,52]
				]
			}]}]}`,
			f: func(t *testing.T, got *backend.QueryDataResponse) {
				newField := data.NewField("value", nil, []*float64{nil, nil, util.Pointer(52.0)})
				newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
				testFrame := data.NewFrame("cpu.mean",
					data.NewField("time", nil,
						[]time.Time{
							time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
						}),
					newField,
				)
				testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Responses["A"].Frames[0])
			},
		},
		{
			name: "Influxdb response parser with valid value when all values are null",
			input: `{ "results": [ { "series": [ {
				"name": "cpu",
				"columns": ["time","mean"],
				"values": [
					[100,null],
					[101,null],
					[102,null]
				]
			}]}]}`,
			f: func(t *testing.T, got *backend.QueryDataResponse) {
				newField := data.NewField("value", nil, []*float64{nil, nil, nil})
				newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
				testFrame := data.NewFrame("cpu.mean",
					data.NewField("time", nil,
						[]time.Time{
							time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
						}),
					newField,
				)
				testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Responses["A"].Frames[0])
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := &ResponseParser{}
			got := parser.Parse(prepare(tt.input), addQueryToQueries(Query{}))
			require.NotNil(t, got)
			if tt.f != nil {
				tt.f(t, got)
			}
		})
	}
}
