package influxdb

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func responseFromJSON(t *testing.T, text string) *Response {
	buf := ioutil.NopCloser(strings.NewReader(text))
	response, err := parseJSON(buf)
	require.NoError(t, err)
	return response
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

		require.Len(t, result.Series, 2)

		require.Len(t, result.Series[0].Points, 3)
		require.Len(t, result.Series[1].Points, 3)

		require.Equal(t, result.Series[0].Points[1][0].Float64, float64(222))
		require.Equal(t, result.Series[1].Points[1][0].Float64, float64(333))

		require.False(t, result.Series[0].Points[2][0].Valid)

		require.Equal(t, result.Series[0].Name, "cpu.mean { datacenter: America }")
		require.Equal(t, result.Series[1].Name, "cpu.sum { datacenter: America }")
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
		require.Len(t, result.Series, 1)

		require.Len(t, result.Series[0].Points, 3)

		require.Equal(t, result.Series[0].Points[0][0].Float64, float64(50))
		require.False(t, result.Series[0].Points[1][0].Valid)
		require.Equal(t, result.Series[0].Points[2][0].Float64, float64(52))
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

		// the current behavior is that we do not report an error, we skip the item with the invalid timestmap
		require.Nil(t, result.Error)
		require.Equal(t, result.ErrorString, "")
		require.Len(t, result.Series, 1)

		require.Len(t, result.Series[0].Points, 2)

		require.Equal(t, result.Series[0].Points[0][0].Float64, float64(50))
		require.Equal(t, result.Series[0].Points[1][0].Float64, float64(52))
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

		require.Equal(t, result.Series[0].Name, "series alias")

		query = &Query{Alias: "alias $m $measurement", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias 10m 10m")

		query = &Query{Alias: "alias $col", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias mean")
		require.Equal(t, result.Series[1].Name, "alias sum")

		query = &Query{Alias: "alias $tag_datacenter"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias America")

		query = &Query{Alias: "alias $1"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias upc")

		query = &Query{Alias: "alias $5"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias $5")

		query = &Query{Alias: "series alias"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "series alias")

		query = &Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias 10m 10m")

		query = &Query{Alias: "alias [[col]]", Measurement: "10m"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias mean")
		require.Equal(t, result.Series[1].Name, "alias sum")

		query = &Query{Alias: "alias [[tag_datacenter]]"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias America")

		query = &Query{Alias: "alias [[tag_dc.region.name]]"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias Northeast")

		query = &Query{Alias: "alias [[tag_cluster-name]]"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias Cluster")

		query = &Query{Alias: "alias [[tag_/cluster/name/]]"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias Cluster/")

		query = &Query{Alias: "alias [[tag_@cluster@name@]]"}
		result = parser.Parse(response, query)

		require.Equal(t, result.Series[0].Name, "alias Cluster@")
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

		require.Len(t, result.Series, 2)

		require.Len(t, result.Series[0].Points, 3)
		require.Len(t, result.Series[1].Points, 3)

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

		require.Len(t, result.Series, 0)

		require.Error(t, result.Error)
		require.Equal(t, result.Error.Error(), "error parsing query: found THING")
	})
}
