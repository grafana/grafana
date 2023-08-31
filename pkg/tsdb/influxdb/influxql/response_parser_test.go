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
		floatFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

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
		stringFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

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
		boolFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

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
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

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
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}

		result := ResponseParse(prepare(response), 200, generateQuery(query))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
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
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
		result := ResponseParse(prepare(response), 200, generateQuery(query))
		t.Run("should parse aliases", func(t *testing.T) {
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $m $measurement", Measurement: "10m"}
			result = ResponseParse(prepare(response), 200, generateQuery(query))

			name := "alias 10m 10m"
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
			name = "alias 10m 10m"
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
		testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
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

func TestResponseParser_Parse(t *testing.T) {
	tests := []struct {
		name  string
		input string
		f     func(t *testing.T, got backend.DataResponse)
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
				testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Frames[0])
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
				testFrame.Meta = &data.FrameMeta{ExecutedQueryString: "Test raw query"}
				assert.Equal(t, testFrame, got.Frames[0])
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResponseParse(prepare(tt.input), 200, generateQuery(models.Query{}))
			require.NotNil(t, got)
			if tt.f != nil {
				tt.f(t, *got)
			}
		})
	}
}
