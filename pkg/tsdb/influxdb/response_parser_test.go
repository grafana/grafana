package influxdb

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func prepare(text string) io.ReadCloser {
	return ioutil.NopCloser(strings.NewReader(text))
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should handle invalid JSON", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `{ invalid }`

		query := &Query{}

		result := parser.Parse(prepare(response), query)

		require.Nil(t, result.Responses["A"].Frames)
		require.Error(t, result.Responses["A"].Error)
	})

	t.Run("Influxdb response parser should parse everything normally", func(t *testing.T) {
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
				}
			]
		}
		`

		query := &Query{}
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)
		newField := data.NewField("value", labels, []*float64{
			pointer.Float64(222), pointer.Float64(222), nil,
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		testFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
				}),
			newField,
		)

		result := parser.Parse(prepare(response), query)

		frame := result.Responses["A"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
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
			pointer.Float64(50), nil, pointer.Float64(52),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 1, 40, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 41, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 42, 0, time.UTC),
				}),
			newField,
		)

		result := parser.Parse(prepare(response), query)

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
			pointer.Float64(50), pointer.Float64(52),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean"}
		testFrame := data.NewFrame("cpu.mean",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 1, 40, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 42, 0, time.UTC),
				}),
			newField,
		)

		result := parser.Parse(prepare(response), query)

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
			pointer.Float64(222),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "series alias"}
		testFrame := data.NewFrame("series alias",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
				}),
			newField,
		)
		result := parser.Parse(prepare(response), query)
		t.Run("should parse aliases", func(t *testing.T) {
			frame := result.Responses["A"]
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $m $measurement", Measurement: "10m"}
			result = parser.Parse(prepare(response), query)

			frame = result.Responses["A"]
			name := "alias 10m 10m"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $col", Measurement: "10m"}
			result = parser.Parse(prepare(response), query)
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
				pointer.Float64(333),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $tag_datacenter"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias America"
			testFrame.Name = name
			newField = data.NewField("value", labels, []*float64{
				pointer.Float64(222),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $tag_datacenter/$tag_datacenter"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias America/America"
			testFrame.Name = name
			newField = data.NewField("value", labels, []*float64{
				pointer.Float64(222),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[col]]", Measurement: "10m"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $0 $1 $2 $3 $4"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias cpu upc $2 $3 $4"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $1"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias $5"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias $5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "series alias"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "series alias"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias 10m 10m"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_datacenter]]"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias America"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_dc.region.name]]"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias Northeast"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_cluster-name]]"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias Cluster"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_/cluster/name/]]"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias Cluster/"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias [[tag_@cluster@name@]]"}
			result = parser.Parse(prepare(response), query)
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
			result = parser.Parse(prepare(response), query)
			frame := result.Responses["A"]
			name := "alias words with no brackets"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias Test 1.5"}
			result = parser.Parse(prepare(response), query)
			frame = result.Responses["A"]
			name = "alias Test 1.5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = &Query{Alias: "alias Test -1"}
			result = parser.Parse(prepare(response), query)
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
		labels, err := data.LabelsFromString("datacenter=America")
		require.Nil(t, err)
		newField := data.NewField("value", labels, []*float64{
			pointer.Float64(222), pointer.Float64(222), nil,
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "cpu.mean { datacenter: America }"}
		testFrame := data.NewFrame("cpu.mean { datacenter: America }",
			data.NewField("time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
					time.Date(1970, 1, 1, 0, 1, 51, 0, time.UTC),
				}),
			newField,
		)
		result := parser.Parse(prepare(response), query)

		frame := result.Responses["A"]
		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		require.EqualError(t, result.Responses["A"].Error, "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		parser := &ResponseParser{}

		response := `
		{
			"error": "error parsing query: found THING"
		}
		`

		query := &Query{}

		result := parser.Parse(prepare(response), query)

		require.Nil(t, result.Responses["A"].Frames)

		require.EqualError(t, result.Responses["A"].Error, "error parsing query: found THING")
	})

	t.Run("Influxdb response parser parseValue nil", func(t *testing.T) {
		value := parseValue(nil)
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseValue valid JSON.number", func(t *testing.T) {
		value := parseValue(json.Number("95.4"))
		require.Equal(t, *value, 95.4)
	})

	t.Run("Influxdb response parser parseValue invalid type", func(t *testing.T) {
		value := parseValue("95.4")
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseTimestamp valid JSON.number", func(t *testing.T) {
		// currently we use seconds-precision with influxdb, so the test works with that.
		// if we change this to for example milliseconds-precision, the tests will have to change.
		timestamp, err := parseTimestamp(json.Number("1609556645"))
		require.NoError(t, err)
		require.Equal(t, timestamp.Format(time.RFC3339), "2021-01-02T03:04:05Z")
	})

	t.Run("Influxdb response parser parseValue invalid type", func(t *testing.T) {
		_, err := parseTimestamp("hello")
		require.Error(t, err)
	})
}
