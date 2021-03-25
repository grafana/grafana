package influxdb

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should parse everything normally", func(t *testing.T) {
		parser := &ResponseParser{}

		cfg := setting.NewCfg()
		err := cfg.Load(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		require.NoError(t, err)

		response := &Response{
			Results: []Result{
				{
					Series: []Row{
						{
							Name:    "cpu",
							Columns: []string{"time", "mean", "sum"},
							Tags:    map[string]string{"datacenter": "America"},
							Values: [][]interface{}{
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("null"), json.Number("333")},
							},
						},
					},
				},
			},
		}

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

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
		parser := &ResponseParser{}

		response := &Response{
			Results: []Result{
				{
					Series: []Row{
						{
							Name:    "cpu.upc",
							Columns: []string{"time", "mean", "sum"},
							Tags: map[string]string{
								"datacenter":     "America",
								"dc.region.name": "Northeast",
								"cluster-name":   "Cluster",
							},
							Values: [][]interface{}{
								{json.Number("111"), json.Number("222"), json.Number("333")},
							},
						},
					},
				},
			},
		}

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
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
		parser := &ResponseParser{}

		cfg := setting.NewCfg()
		err := cfg.Load(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		require.Nil(t, err)

		response := &Response{
			Results: []Result{
				{
					Series: []Row{
						{
							Name:    "cpu",
							Columns: []string{"time", "mean", "sum"},
							Tags:    map[string]string{"datacenter": "America"},
							Values: [][]interface{}{
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("null"), json.Number("333")},
							},
						},
					},
				},
				{
					Err: fmt.Errorf("query-timeout limit exceeded"),
				},
			},
		}

		query := &Query{}

		result := parser.Parse(response, query)

		require.Len(t, result.Series, 2)

		require.Len(t, result.Series[0].Points, 3)
		require.Len(t, result.Series[1].Points, 3)

		require.Error(t, result.Error)
		require.Equal(t, result.Error.Error(), "query-timeout limit exceeded")
	})
}
