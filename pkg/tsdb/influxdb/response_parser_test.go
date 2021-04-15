package influxdb

import (
	"encoding/json"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func responseFromJSON(t *testing.T, text string) Response {
	buf := ioutil.NopCloser(strings.NewReader(text))
	response, err := parseJSON(buf)
	require.NoError(t, err)
	return response
}

func decodedFrames(t *testing.T, result *plugins.DataQueryResult) data.Frames {
	decoded, err := result.Dataframes.Decoded()
	require.NoError(t, err)
	return decoded
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should parse everything normally", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
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
		`)

		query := &Query{}

		result := parser.Parse(response, query)

		decoded := decodedFrames(t, &result)
		require.Len(t, decoded, 2)
		frame1 := decoded[0]
		frame2 := decoded[1]

		require.Equal(t, frame1.Name, "cpu.mean { datacenter: America }")
		require.Equal(t, frame2.Name, "cpu.sum { datacenter: America }")

		require.Len(t, frame1.Fields, 2)
		require.Len(t, frame2.Fields, 2)

		require.Equal(t, frame1.Fields[0].Len(), 3)
		require.Equal(t, frame1.Fields[1].Len(), 3)
		require.Equal(t, frame2.Fields[0].Len(), 3)
		require.Equal(t, frame2.Fields[1].Len(), 3)

		require.Equal(t, *frame1.Fields[1].At(1).(*float64), 222.0)
		require.Equal(t, *frame2.Fields[1].At(1).(*float64), 333.0)
		require.Nil(t, frame1.Fields[1].At(2))
	})

	t.Run("Influxdb response parser with invalid value-format", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
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
		`)

		query := &Query{}

		result := parser.Parse(response, query)

		// the current behavior is that we do not report an error, we turn the invalid value into `nil`
		require.Nil(t, result.Error)
		require.Equal(t, result.ErrorString, "")

		decoded := decodedFrames(t, &result)
		require.Len(t, decoded, 1)

		frame := decoded[0]

		require.Len(t, frame.Fields, 2)

		field1 := frame.Fields[0]
		field2 := frame.Fields[1]

		require.Equal(t, field1.Len(), 3)
		require.Equal(t, field2.Len(), 3)

		require.Equal(t, *field2.At(0).(*float64), 50.0)
		require.Nil(t, field2.At(1))
		require.Equal(t, *field2.At(2).(*float64), 52.0)
	})

	t.Run("Influxdb response parser with invalid timestamp-format", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
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
		`)

		query := &Query{}

		result := parser.Parse(response, query)

		// the current behavior is that we do not report an error, we skip the item with the invalid timestamp
		require.Nil(t, result.Error)
		require.Equal(t, result.ErrorString, "")

		decoded := decodedFrames(t, &result)
		require.Len(t, decoded, 1)

		frame := decoded[0]

		require.Len(t, frame.Fields, 2)

		field1 := frame.Fields[0]
		field2 := frame.Fields[1]

		require.Equal(t, field1.Len(), 2)
		require.Equal(t, field2.Len(), 2)

		require.Equal(t, *field2.At(0).(*float64), 50.0)
		require.Equal(t, *field2.At(1).(*float64), 52.0)
	})

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
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
		`)

		query := &Query{Alias: "series alias"}
		result := parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "series alias")

		query = &Query{Alias: "alias $m $measurement", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias 10m 10m")

		query = &Query{Alias: "alias $col", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias mean")
		require.Equal(t, decodedFrames(t, &result)[1].Name, "alias sum")

		query = &Query{Alias: "alias $tag_datacenter"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias America")

		query = &Query{Alias: "alias $1"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias upc")

		query = &Query{Alias: "alias $5"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias $5")

		query = &Query{Alias: "series alias"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "series alias")

		query = &Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias 10m 10m")

		query = &Query{Alias: "alias [[col]]", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias mean")
		require.Equal(t, decodedFrames(t, &result)[1].Name, "alias sum")

		query = &Query{Alias: "alias [[tag_datacenter]]"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias America")

		query = &Query{Alias: "alias [[tag_dc.region.name]]"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias Northeast")

		query = &Query{Alias: "alias [[tag_cluster-name]]"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias Cluster")

		query = &Query{Alias: "alias [[tag_/cluster/name/]]"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias Cluster/")

		query = &Query{Alias: "alias [[tag_@cluster@name@]]"}
		result = parser.Parse(response, query)

		require.Equal(t, decodedFrames(t, &result)[0].Name, "alias Cluster@")
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
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
		`)

		query := &Query{}

		result := parser.Parse(response, query)

		decoded := decodedFrames(t, &result)

		require.Len(t, decoded, 2)

		require.Equal(t, decoded[0].Fields[0].Len(), 3)
		require.Equal(t, decoded[0].Fields[1].Len(), 3)
		require.Equal(t, decoded[1].Fields[0].Len(), 3)
		require.Equal(t, decoded[1].Fields[1].Len(), 3)

		require.Error(t, result.Error)
		require.Equal(t, result.Error.Error(), "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		parser := &ResponseParser{}

		response := responseFromJSON(t, `
		{
			"error": "error parsing query: found THING"
		}
		`)

		query := &Query{}

		result := parser.Parse(response, query)

		require.Nil(t, result.Dataframes)

		require.Error(t, result.Error)
		require.Equal(t, result.Error.Error(), "error parsing query: found THING")
	})

	t.Run("Influxdb response parser parseValue nil", func(t *testing.T) {
		value, err := parseValue(nil)
		require.NoError(t, err)
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseValue valid JSON.number", func(t *testing.T) {
		value, err := parseValue(json.Number("95.4"))
		require.NoError(t, err)
		require.Equal(t, *value, 95.4)
	})

	t.Run("Influxdb response parser parseValue invalid type", func(t *testing.T) {
		_, err := parseValue("95.4")
		require.Error(t, err)
	})
}
