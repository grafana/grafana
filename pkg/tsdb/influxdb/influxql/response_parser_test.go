package influxql

import (
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/util"
)

func prepare(text string) io.ReadCloser {
	return io.NopCloser(strings.NewReader(text))
}

func generateQuery(query models.Query) *models.Query {
	if query.RefID == "" {
		query.RefID = "A"
	}
	if query.RawQuery == "" {
		query.RawQuery = "Test raw query"
	}

	if query.ResultFormat == "" {
		query.ResultFormat = "time_series"
	}
	return &query
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should handle invalid JSON", func(t *testing.T) {
		response := `{ invalid }`

		query := models.Query{}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		require.Nil(t, result.Frames)
		require.Error(t, result.Error)
	})

	t.Run("Influxdb response parser should parse everything normally including nil bools and nil strings", func(t *testing.T) {
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

		query := models.Query{}
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)

		floatField := data.NewField("Value", labels, []*float64{
			util.Pointer(222.0), util.Pointer(222.0), nil,
		})
		floatField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		floatFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			floatField,
		)
		floatFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}

		string_test := "/usr/path"
		stringField := data.NewField("Value", labels, []*string{
			nil, &string_test, &string_test,
		})
		stringField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.path { datacenter: America }"}
		stringFrame := data.NewFrame("cpu.path { datacenter: America }",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			stringField,
		)
		stringFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}

		bool_true := true
		bool_false := false
		boolField := data.NewField("Value", labels, []*bool{
			nil, &bool_false, &bool_true,
		})
		boolField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.isActive { datacenter: America }"}
		boolFrame := data.NewFrame("cpu.isActive { datacenter: America }",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			boolField,
		)
		boolFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(floatFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff(stringFrame, result.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
		if diff := cmp.Diff(boolFrame, result.Frames[2], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse metricFindQueries normally", func(t *testing.T) {
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

		query := models.Query{RefID: "metricFindQuery"}
		newField := data.NewField("Value", nil, []string{
			"cpu", "disk", "logs",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse metricFindQueries->SHOW TAG VALUES normally", func(t *testing.T) {
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

		query := models.Query{RawQuery: "SHOW TAG VALUES", RefID: "metricFindQuery"}
		newField := data.NewField("Value", nil, []string{
			"cpu-total", "cpu0", "cpu1",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser populates the RawQuery in the response meta ExecutedQueryString", func(t *testing.T) {
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

		query := models.Query{}
		query.RawQuery = "Test raw query"
		result := ResponseParse(prepare(response), 200, generateQuery(query))

		assert.Equal(t, result.Frames[0].Meta.ExecutedQueryString, "Test raw query")
	})

	t.Run("Influxdb response parser with invalid value-format", func(t *testing.T) {
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

		query := models.Query{}

		newField := data.NewField("Value", nil, []*float64{
			util.Pointer(50.0), nil, util.Pointer(52.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with invalid timestamp-format", func(t *testing.T) {
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

		query := models.Query{}

		newField := data.NewField("Value", nil, []*float64{
			util.Pointer(50.0), util.Pointer(52.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with $measurement alias when multiple measurement in response", func(t *testing.T) {
		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu.upc",
							"columns": ["time","mean"],
							"tags": {
								"datacenter": "America",
								"dc.region.name": "Northeast",
								"cluster-name":   "Cluster"
							},
							"values": [
								[111,222]
							]
						},
						{
							"name": "logins.count",
							"columns": ["time","mean"],
							"tags": {
								"datacenter": "America",
								"dc.region.name": "Northeast",
								"cluster-name":   "Cluster"
							},
							"values": [
								[111,222]
							]
						}
					]
				}
			]
		}
		`

		query := models.Query{Alias: "alias $measurement"}
		result := ResponseParse(prepare(response), 200, generateQuery(query))
		assert.Equal(t, "alias cpu.upc", result.Frames[0].Name)
		assert.Equal(t, "alias logins.count", result.Frames[1].Name)
	})

	t.Run("Influxdb response parser when multiple measurement in response", func(t *testing.T) {
		response := `
		{
			"results": [
				{
					"series": [
						{
							"name": "cpu.upc",
							"columns": ["time","mean"],
							"tags": {
								"datacenter": "America",
								"cluster-name":   "Cluster"
							},
							"values": [
								[111,222]
							]
						},
						{
							"name": "logins.count",
							"columns": ["time","mean"],
							"tags": {
								"datacenter": "America",
								"cluster-name":   "Cluster"
							},
							"values": [
								[111,222]
							]
						}
					]
				}
			]
		}
		`

		query := models.Query{}
		result := ResponseParse(prepare(response), 200, generateQuery(query))
		assert.True(t, strings.Contains(result.Frames[0].Name, ","))
		assert.True(t, strings.Contains(result.Frames[1].Name, ","))
	})

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
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

		query := models.Query{Alias: "series alias"}
		labels, err := data.LabelsFromString("/cluster/name/=Cluster/, @cluster@name@=Cluster@, cluster-name=Cluster, datacenter=America, dc.region.name=Northeast")
		require.Nil(t, err)
		newField := data.NewField("Value", labels, []*float64{
			util.Pointer(222.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "series alias"}
		testFrame := data.NewFrame("series alias",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}
		result := ResponseParse(prepare(response), 200, generateQuery(query))
		t.Run("should parse aliases", func(t *testing.T) {
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $m $measurement", Measurement: "10m"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))

			name := "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $col", Measurement: "10m"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
			name = "alias sum"
			testFrame.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.Pointer(333.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, result.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $tag_datacenter"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias America"
			testFrame.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.Pointer(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $tag_datacenter/$tag_datacenter"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias America/America"
			testFrame.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.Pointer(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[col]]", Measurement: "10m"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $0 $1 $2 $3 $4"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias cpu upc $2 $3 $4"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $0, $1 - $2 - $3, $4: something"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias cpu, upc - $2 - $3, $4: something"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $1"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $5"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias $5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "series alias"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "series alias"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_datacenter]]"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias America"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_dc.region.name]]"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Northeast"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_cluster-name]]"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Cluster"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_/cluster/name/]]"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Cluster/"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_@cluster@name@]]"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Cluster@"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
		t.Run("shouldn't parse aliases", func(t *testing.T) {
			query = models.Query{Alias: "alias words with no brackets"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name := "alias words with no brackets"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias Test 1.5"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Test 1.5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias Test -1"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))
			name = "alias Test -1"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
		response := `
		{
			"results": [
				{
					"error": "query-timeout limit exceeded"
				}
			]
		}
		`

		query := models.Query{}
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)
		newField := data.NewField("Value", labels, []*float64{
			util.Pointer(222.0), util.Pointer(222.0), nil,
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		testFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}
		result := ResponseParse(prepare(response), 200, generateQuery(query))

		require.EqualError(t, result.Error, "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		response := `
		{
			"error": "error parsing query: found THING"
		}
		`

		query := models.Query{}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		require.Nil(t, result.Frames)

		require.EqualError(t, result.Error, "error parsing query: found THING")
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

func TestResponseParser_Parse_RetentionPolicy(t *testing.T) {
	t.Run("Influxdb response parser should parse metricFindQueries->SHOW RETENTION POLICIES normally", func(t *testing.T) {
		response := `
		{
		  "results": [
		    {
		      "statement_id": 0,
		      "series": [
		        {
		          "columns": [
		            "name",
		            "duration",
		            "shardGroupDuration",
		            "replicaN",
		            "default"
		          ],
		          "values": [
		            [
		              "autogen",
		              "0s",
		              "168h0m0s",
		              1,
		              false
		            ],
		            [
		              "bar",
		              "24h0m0s",
		              "1h0m0s",
		              1,
		              true
		            ],
		            [
		              "5m_avg",
		              "2400h0m0s",
		              "24h0m0s",
		              1,
		              false
		            ],
		            [
		              "1m_avg",
		              "240h0m0s",
		              "24h0m0s",
		              1,
		              false
		            ]
		          ]
		        }
		      ]
		    }
		  ]
		}
		`

		query := models.Query{RefID: "metricFindQuery", RawQuery: "SHOW RETENTION POLICIES"}
		policyFrame := data.NewFrame("",
			data.NewField("Value", nil, []string{
				"bar", "autogen", "5m_avg", "1m_avg",
			}),
		)

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(policyFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestResponseParser_table_format(t *testing.T) {
	t.Run("test table result format parsing", func(t *testing.T) {
		resp := ResponseParse(prepare(tableResultFormatInfluxResponse1), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		assert.Equal(t, 3, len(resp.Frames[0].Fields))
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, "Time", resp.Frames[0].Fields[0].Name)
		assert.Equal(t, "usage_idle", resp.Frames[0].Fields[1].Name)
		assert.Equal(t, toPtr(99.09456740445926), resp.Frames[0].Fields[1].At(2))
		assert.Equal(t, "usage_iowait", resp.Frames[0].Fields[2].Name)
	})

	t.Run("test table result format parsing with grouping", func(t *testing.T) {
		resp := ResponseParse(prepare(tableResultFormatInfluxResponse2), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		assert.Equal(t, 7, len(resp.Frames[0].Fields))
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, "Time", resp.Frames[0].Fields[0].Name)
		assert.Equal(t, "cpu", resp.Frames[0].Fields[1].Name)
		assert.Equal(t, toPtr("cpu-total"), resp.Frames[0].Fields[1].At(0))
		assert.Equal(t, toPtr("cpu0"), resp.Frames[0].Fields[1].At(1))
		assert.Equal(t, toPtr("cpu9"), resp.Frames[0].Fields[1].At(10))
		assert.Equal(t, "mean", resp.Frames[0].Fields[2].Name)
		assert.Equal(t, "min", resp.Frames[0].Fields[3].Name)
		assert.Equal(t, "p90", resp.Frames[0].Fields[4].Name)
		assert.Equal(t, "p95", resp.Frames[0].Fields[5].Name)
		assert.Equal(t, "max", resp.Frames[0].Fields[6].Name)
	})

	t.Run("parse result as table group by tag", func(t *testing.T) {
		resp := ResponseParse(prepare(tableResultFormatInfluxResponse3), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, "Time", resp.Frames[0].Fields[0].Name)
		assert.Equal(t, "cpu", resp.Frames[0].Fields[1].Name)
		assert.Equal(t, resp.Frames[0].Fields[1].Name, resp.Frames[0].Fields[1].Config.DisplayNameFromDS)
		assert.Equal(t, toPtr("cpu-total"), resp.Frames[0].Fields[1].At(0))
		assert.Equal(t, toPtr("cpu0"), resp.Frames[0].Fields[1].At(5))
		assert.Equal(t, toPtr("cpu2"), resp.Frames[0].Fields[1].At(12))
		assert.Equal(t, "mean", resp.Frames[0].Fields[2].Name)
		assert.Equal(t, resp.Frames[0].Fields[2].Name, resp.Frames[0].Fields[2].Config.DisplayNameFromDS)
	})

	t.Run("parse result without tags as table", func(t *testing.T) {
		resp := ResponseParse(prepare(tableResultFormatInfluxResponse4), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, "Time", resp.Frames[0].Fields[0].Name)
		assert.Equal(t, "mean", resp.Frames[0].Fields[1].Name)
		assert.Equal(t, resp.Frames[0].Fields[1].Name, resp.Frames[0].Fields[1].Config.DisplayNameFromDS)
	})

	t.Run("parse show measurements response as table", func(t *testing.T) {
		resp := ResponseParse(prepare(showMeasurementsResponse), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, 1, len(resp.Frames[0].Fields))
		assert.Equal(t, "name", resp.Frames[0].Fields[0].Name)
	})

	t.Run("parse retention policy response as table", func(t *testing.T) {
		resp := ResponseParse(prepare(showRetentionPolicyResponse), 200, &models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"})
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, 5, len(resp.Frames[0].Fields))
		assert.Equal(t, "name", resp.Frames[0].Fields[0].Name)
		assert.Equal(t, "duration", resp.Frames[0].Fields[1].Name)
		assert.Equal(t, "shardGroupDuration", resp.Frames[0].Fields[2].Name)
		assert.Equal(t, "replicaN", resp.Frames[0].Fields[3].Name)
		assert.Equal(t, "default", resp.Frames[0].Fields[4].Name)
	})
}

func TestResponseParser_Parse(t *testing.T) {
	tests := []struct {
		name      string
		resFormat string
		input     string
		f         func(t *testing.T, got backend.DataResponse)
	}{
		{
			name:      "Influxdb response parser with valid value when null values returned",
			resFormat: "time_series",
			input: `{ "results": [ { "series": [ {
				"name": "cpu",
				"columns": ["time","mean"],
				"values": [
					[100,null],
					[101,null],
					[102,52]
				]
			}]}]}`,
			f: func(t *testing.T, got backend.DataResponse) {
				newField := data.NewField("Value", nil, []*float64{nil, nil, util.Pointer(52.0)})
				newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
				testFrame := data.NewFrame("cpu.mean",
					data.NewField("Time", nil,
						[]time.Time{
							time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
						}),
					newField,
				)
				testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Frames[0])
			},
		},
		{
			name:      "Influxdb response parser with valid value when all values are null",
			resFormat: "time_series",
			input: `{ "results": [ { "series": [ {
				"name": "cpu",
				"columns": ["time","mean"],
				"values": [
					[100,null],
					[101,null],
					[102,null]
				]
			}]}]}`,
			f: func(t *testing.T, got backend.DataResponse) {
				newField := data.NewField("Value", nil, []*float64{nil, nil, nil})
				newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
				testFrame := data.NewFrame("cpu.mean",
					data.NewField("Time", nil,
						[]time.Time{
							time.Date(1970, 1, 1, 0, 0, 0, 100000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 101000000, time.UTC),
							time.Date(1970, 1, 1, 0, 0, 0, 102000000, time.UTC),
						}),
					newField,
				)
				testFrame.Meta = &data.FrameMeta{PreferredVisualization: graphVisType, ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Frames[0])
			},
		},
		{
			name:      "Influxdb response parser with table result",
			resFormat: "table",
			input: `{
					  "results": [
					    {
					      "statement_id": 0,
					      "series": [
					        {
					          "name": "Annotation",
					          "columns": [
					            "time",
					            "domain",
					            "type",
					            "ASD",
					            "details"
					          ],
					          "values": [
					            [
					              1697789142916,
					              "AASD157",
					              "fghg",
					              null,
					              "Something happened AtTime=2023-10-20T08:05:42.902036"
					            ],
					            [
					              1697789142918,
					              "HUY23",
					              "val23",
					              null,
					              "Something else happened AtTime=2023-10-20T08:05:42.902036"
					            ]
					          ]
					        }
					      ]
					    }
					  ]
					}`,
			f: func(t *testing.T, got backend.DataResponse) {
				assert.Equal(t, "Annotation", got.Frames[0].Name)
				assert.Equal(t, "domain", got.Frames[0].Fields[1].Config.DisplayNameFromDS)
				assert.Equal(t, "type", got.Frames[0].Fields[2].Config.DisplayNameFromDS)
				assert.Equal(t, tableVisType, got.Frames[0].Meta.PreferredVisualization)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResponseParse(prepare(tt.input), 200, generateQuery(models.Query{ResultFormat: tt.resFormat}))
			require.NotNil(t, got)
			if tt.f != nil {
				tt.f(t, *got)
			}
		})
	}
}

func toPtr[T any](v T) *T {
	return &v
}

const tableResultFormatInfluxResponse1 = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "cpu",
          "columns": [
            "time",
            "usage_idle",
            "usage_iowait"
          ],
          "values": [
            [
              1700090120000,
              99.0255173802101,
              0.020092425155804713
            ],
            [
              1700090120000,
              99.29718875523953,
              0
            ],
            [
              1700090120000,
              99.09456740445926,
              0
            ],
            [
              1700090120000,
              99.39455095864957,
              0
            ],
            [
              1700090120000,
              99.09729187566201,
              0
            ]
          ]
        }
      ]
    }
  ]
}`

const tableResultFormatInfluxResponse2 = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu-total"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.06348570053983,
              97.3214285712978,
              99.2066680055868,
              99.24812030075188,
              99.31809065366402
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu0"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              98.99671817733766,
              96.65991902847126,
              99.29364278499536,
              99.29718875523953,
              99.59839357421622
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu1"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.03148357927465,
              96.67673715996412,
              99.39698492464545,
              99.39759036146867,
              99.59798994966731
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu2"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.03087433486812,
              96.03658536600605,
              99.29859719431953,
              99.39759036146867,
              99.59879638908582
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu3"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.0796957137731,
              97.37903225797402,
              99.39698492464723,
              99.39879759521435,
              99.4984954865762
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu4"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.09573460946685,
              97.57330637016123,
              99.39759036146867,
              99.49698189117252,
              99.59839357450608
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu5"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.0690883079725,
              96.65991902847126,
              99.39698492464545,
              99.39819458377468,
              99.59798994995865
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu6"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.06475215715605,
              97.37108190081956,
              99.39698492464545,
              99.39879759521259,
              99.69879518073434
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu7"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.06204005079694,
              97.7596741344093,
              99.39637826964127,
              99.39759036147042,
              99.59879638908698
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu8"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.0999818796052,
              96.56565656568982,
              99.39698492464723,
              99.39819458377468,
              99.59758551299777
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu9"
          },
          "columns": [
            "time",
            "mean",
            "min",
            "p90",
            "p95",
            "max"
          ],
          "values": [
            [
              1700046000000,
              99.10477313534511,
              96.8463886063268,
              99.39759036146867,
              99.39819458377468,
              99.59839357421622
            ]
          ]
        }
      ]
    }
  ]
}
`

const tableResultFormatInfluxResponse3 = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu-total"
          },
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.06919189833442
            ],
            [
              1700047200000,
              99.13105510262923
            ],
            [
              1700048400000,
              98.99236330721192
            ],
            [
              1700049600000,
              98.80510091380069
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu0"
          },
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.01372119142576
            ],
            [
              1700047200000,
              99.00430308480553
            ],
            [
              1700048400000,
              98.9737996641964
            ],
            [
              1700049600000,
              98.79638916754935
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu1"
          },
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.04949983158023
            ],
            [
              1700047200000,
              99.06989461231551
            ],
            [
              1700048400000,
              98.97954813782476
            ],
            [
              1700049600000,
              98.49246231161365
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu2"
          },
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.11296419686643
            ],
            [
              1700047200000,
              99.01817278917116
            ],
            [
              1700048400000,
              98.96847021232013
            ],
            [
              1700049600000,
              98.192771084406
            ]
          ]
        },
        {
          "name": "cpu",
          "tags": {
            "cpu": "cpu3"
          },
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.0742704326151
            ],
            [
              1700047200000,
              99.17835628293322
            ],
            [
              1700048400000,
              98.98968994907334
            ],
            [
              1700049600000,
              98.69215291745849
            ]
          ]
        }
      ]
    }
  ]
}
`

const tableResultFormatInfluxResponse4 = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "cpu",
          "columns": [
            "time",
            "mean"
          ],
          "values": [
            [
              1700046000000,
              99.0693929754458
            ],
            [
              1700047200000,
              99.13073313839024
            ],
            [
              1700048400000,
              98.99278645182834
            ],
            [
              1700049600000,
              98.77818123433566
            ]
          ]
        }
      ]
    }
  ]
}`

const showMeasurementsResponse = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "measurements",
          "columns": [
            "name"
          ],
          "values": [
            [
              "cpu"
            ],
            [
              "disk"
            ],
            [
              "diskio"
            ],
            [
              "kernel"
            ]
          ]
        }
      ]
    }
  ]
}`

const showRetentionPolicyResponse = `{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "columns": [
            "name",
            "duration",
            "shardGroupDuration",
            "replicaN",
            "default"
          ],
          "values": [
            [
              "default",
              "0s",
              "168h0m0s",
              1,
              true
            ],
            [
              "autogen",
              "0s",
              "168h0m0s",
              1,
              false
            ]
          ]
        }
      ]
    }
  ]
}`
