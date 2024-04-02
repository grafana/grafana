package buffered

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/util"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const (
	shouldUpdate = false
	testPath     = "../testdata"
)

func readJsonFile(filePath string) io.ReadCloser {
	bytes, err := os.ReadFile(filepath.Join(testPath, filepath.Clean(filePath)+".json"))
	if err != nil {
		panic(fmt.Sprintf("cannot read the file: %s", filePath))
	}

	return io.NopCloser(strings.NewReader(string(bytes)))
}

func generateQuery(resFormat string, alias string) *models.Query {
	return &models.Query{
		RawQuery:     "Test raw query",
		UseRawQuery:  true,
		Alias:        alias,
		ResultFormat: resFormat,
	}
}

// show_diagnostics file won't be added to test files because of its inconsistent
// json data with other responses. But I do add it here just to have it.
// It can be parsed with time_series response but not table.
// It only works with InfluxDB v1.x. The usage of it is quite limited.
var testFiles = []string{
	"all_values_are_null",
	"influx_select_all_from_cpu",
	"one_measurement_with_two_columns",
	"response_with_weird_tag",
	"some_values_are_null",
	"simple_response",
	"multiple_series_with_tags_and_multiple_columns",
	"multiple_series_with_tags",
	"empty_response",
	"metric_find_queries",
	"show_tag_values_response",
	"retention_policy",
	"simple_response_with_diverse_data_types",
	"multiple_measurements",
	"string_column_with_null_value",
	"string_column_with_null_value2",
	"many_columns",
	"response_with_nil_bools_and_nil_strings",
	"invalid_value_format",
}

func TestReadInfluxAsTimeSeries(t *testing.T) {
	for _, f := range testFiles {
		t.Run(f, runScenario(f, "time_series"))
	}
}

func TestReadInfluxAsTable(t *testing.T) {
	for _, f := range testFiles {
		t.Run(f, runScenario(f, "table"))
	}
}

func runScenario(tf string, resultFormat string) func(t *testing.T) {
	return func(t *testing.T) {
		f, err := os.Open(path.Join(testPath, filepath.Clean(tf+".json")))
		require.NoError(t, err)

		query := generateQuery(resultFormat, "")

		rsp := ResponseParse(io.NopCloser(f), 200, query)
		require.NoError(t, rsp.Error)

		fname := tf + "." + resultFormat + ".golden"
		experimental.CheckGoldenJSONResponse(t, testPath, fname, rsp, shouldUpdate)
	}
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should handle invalid JSON", func(t *testing.T) {
		result := ResponseParse(
			io.NopCloser(strings.NewReader(`{ invalid }`)),
			200,
			generateQuery("time_series", ""),
		)

		require.Nil(t, result.Frames)
		require.Error(t, result.Error)
	})

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
		labels, err := data.LabelsFromString("/cluster/name/=Cluster/, @cluster@name@=Cluster@, cluster-name=Cluster, datacenter=America, dc.region.name=Northeast")
		require.Nil(t, err)
		newField := data.NewField("Value", labels, []*float64{
			util.ToPtr(222.0),
		})
		newField.Config = &data.FieldConfig{DisplayNameFromDS: "series alias"}
		testFrame := data.NewFrame("series alias",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: util.GraphVisType, ExecutedQueryString: "Test raw query"}
		testFrameWithoutMeta := data.NewFrame("series alias",
			data.NewField("Time", nil,
				[]time.Time{
					time.Date(1970, 1, 1, 0, 0, 0, 111000000, time.UTC),
				}),
			newField,
		)

		t.Run("should parse aliases", func(t *testing.T) {
			result := ResponseParse(readJsonFile("response"), 200, generateQuery("time_sereies", "alias $m $measurement"))

			name := "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query := generateQuery("time_series", "alias $col")
			query.Measurement = "10m"
			result = ResponseParse(readJsonFile("response"), 200, query)
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
			name = "alias sum"
			testFrameWithoutMeta.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.ToPtr(333.0),
			})
			testFrameWithoutMeta.Fields[1] = newField
			testFrameWithoutMeta.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			testFrameWithoutMeta.Meta = nil
			if diff := cmp.Diff(testFrameWithoutMeta, result.Frames[1], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $tag_datacenter"))
			name = "alias America"
			testFrame.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.ToPtr(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $tag_datacenter/$tag_datacenter"))
			name = "alias America/America"
			testFrame.Name = name
			newField = data.NewField("Value", labels, []*float64{
				util.ToPtr(222.0),
			})
			testFrame.Fields[1] = newField
			testFrame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: name}
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = generateQuery("time_series", "alias [[col]]")
			query.Measurement = "10m"
			result = ResponseParse(readJsonFile("response"), 200, query)
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $0 $1 $2 $3 $4"))
			name = "alias cpu upc $2 $3 $4"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $0, $1 - $2 - $3, $4: something"))
			name = "alias cpu, upc - $2 - $3, $4: something"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $1"))
			name = "alias upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias $5"))
			name = "alias $5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "series alias"))
			name = "series alias"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = generateQuery("time_series", "alias [[m]] [[measurement]]")
			query.Measurement = "10m"
			result = ResponseParse(readJsonFile("response"), 200, query)
			name = "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias [[tag_datacenter]]"))
			name = "alias America"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias [[tag_dc.region.name]]"))
			name = "alias Northeast"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias [[tag_cluster-name]]"))
			name = "alias Cluster"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias [[tag_/cluster/name/]]"))
			name = "alias Cluster/"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias [[tag_@cluster@name@]]"))
			name = "alias Cluster@"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})

		t.Run("shouldn't parse aliases", func(t *testing.T) {
			result := ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias words with no brackets"))
			name := "alias words with no brackets"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias Test 1.5"))
			name = "alias Test 1.5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			result = ResponseParse(readJsonFile("response"), 200, generateQuery("time_series", "alias Test -1"))
			name = "alias Test -1"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
		result := ResponseParse(readJsonFile("error_response"), 200, generateQuery("time_series", ""))

		require.EqualError(t, result.Error, "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		result := ResponseParse(readJsonFile("error_on_top_level_response"), 200, generateQuery("time_series", ""))
		require.Nil(t, result.Frames)
		require.EqualError(t, result.Error, "error parsing query: found THING")
	})

	t.Run("Influxdb response parser parseNumber nil", func(t *testing.T) {
		value := util.ParseNumber(nil)
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser parseNumber valid JSON.number", func(t *testing.T) {
		value := util.ParseNumber(json.Number("95.4"))
		require.Equal(t, *value, 95.4)
	})

	t.Run("Influxdb response parser parseNumber invalid type", func(t *testing.T) {
		value := util.ParseNumber("95.4")
		require.Nil(t, value)
	})

	t.Run("Influxdb response parser with invalid timestamp-format", func(t *testing.T) {
		newField := data.NewField("Value", nil, []*float64{
			util.ToPtr(50.0), util.ToPtr(52.0),
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
		testFrame.Meta = &data.FrameMeta{PreferredVisualization: util.GraphVisType, ExecutedQueryString: "Test raw query"}

		result := ResponseParse(readJsonFile("invalid_timestamp_format"), 200, generateQuery("time_series", ""))

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser parseTimestamp valid JSON.number", func(t *testing.T) {
		// currently we use milliseconds-precision with influxdb, so the test works with that.
		// if we change this to for example nanoseconds-precision, the tests will have to change.
		timestamp, err := util.ParseTimestamp(json.Number("1609556645000"))
		require.NoError(t, err)
		require.Equal(t, timestamp.Format(time.RFC3339), "2021-01-02T03:04:05Z")
	})

	t.Run("Influxdb response parser parseNumber invalid type", func(t *testing.T) {
		_, err := util.ParseTimestamp("hello")
		require.Error(t, err)
	})
}
