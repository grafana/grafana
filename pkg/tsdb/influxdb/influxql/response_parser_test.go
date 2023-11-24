package influxql

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/util"
)

const shouldUpdate = true

func readJsonFile(filePath string) io.ReadCloser {
	bytes, err := os.ReadFile(filepath.Join("testdata", filePath+".json"))
	if err != nil {
		panic("cannot read the file")
	}

	return io.NopCloser(strings.NewReader(string(bytes)))
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

func verifyGoldenResponse(t *testing.T, fileName string, query models.Query, goldenFileExt string) *backend.DataResponse {
	rsp := ResponseParse(readJsonFile(fileName), 200, generateQuery(query))
	golden := fileName + "." + goldenFileExt + "." + "golden"
	experimental.CheckGoldenJSONResponse(t, "testdata", golden, rsp, shouldUpdate)
	// require.NoError(t, rsp.Error)

	return rsp
}

func TestInfluxdbResponseParser(t *testing.T) {
	t.Run("Influxdb response parser should handle invalid JSON", func(t *testing.T) {
		response := `{ invalid }`

		query := models.Query{}

		result := ResponseParse(io.NopCloser(strings.NewReader(response)), 200, generateQuery(query))

		require.Nil(t, result.Frames)
		require.Error(t, result.Error)
	})

	t.Run("Influxdb response parser should parse everything normally including nil bools and nil strings", func(t *testing.T) {
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

		result := verifyGoldenResponse(t, "response_with_nil_bools_and_nil_strings", query, "")

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
		query := models.Query{RefID: "metricFindQuery"}
		newField := data.NewField("Value", nil, []string{
			"cpu", "disk", "logs",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := verifyGoldenResponse(t, "metric_find_queries", query, "")

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser should parse metricFindQueries->SHOW TAG VALUES normally", func(t *testing.T) {

		query := models.Query{RawQuery: "SHOW TAG VALUES", RefID: "metricFindQuery"}
		newField := data.NewField("Value", nil, []string{
			"cpu-total", "cpu0", "cpu1",
		})
		testFrame := data.NewFrame("cpu",
			newField,
		)

		result := verifyGoldenResponse(t, "show_tag_values_response", query, "")

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser populates the RawQuery in the response meta ExecutedQueryString", func(t *testing.T) {
		query := models.Query{}
		query.RawQuery = "Test raw query"
		result := verifyGoldenResponse(t, "simple_response", query, "")

		assert.Equal(t, result.Frames[0].Meta.ExecutedQueryString, "Test raw query")
	})

	t.Run("Influxdb response parser with invalid value-format", func(t *testing.T) {
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

		result := verifyGoldenResponse(t, "invalid_value_format", query, "")

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with invalid timestamp-format", func(t *testing.T) {
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

		result := verifyGoldenResponse(t, "invalid_timestamp_format", query, "")

		if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Influxdb response parser with $measurement alias when multiple measurement in response", func(t *testing.T) {
		query := models.Query{Alias: "alias $measurement"}
		result := verifyGoldenResponse(t, "multiple_measurements_with_alias", query, "")
		assert.Equal(t, "alias cpu.upc", result.Frames[0].Name)
		assert.Equal(t, "alias logins.count", result.Frames[1].Name)
	})

	t.Run("Influxdb response parser when multiple measurement in response", func(t *testing.T) {
		query := models.Query{}
		result := ResponseParse(readJsonFile("multiple_measurements"), 200, generateQuery(query))
		assert.True(t, strings.Contains(result.Frames[0].Name, ","))
		assert.True(t, strings.Contains(result.Frames[1].Name, ","))
	})

	t.Run("Influxdb response parser with alias", func(t *testing.T) {
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
		result := verifyGoldenResponse(t, "response", query, "")

		t.Run("should parse aliases", func(t *testing.T) {
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $m $measurement", Measurement: "10m"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))

			name := "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $col", Measurement: "10m"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
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
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
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
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
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
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias mean"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $0 $1 $2 $3 $4"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias cpu upc $2 $3 $4"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $0, $1 - $2 - $3, $4: something"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias cpu, upc - $2 - $3, $4: something"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $1"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias $5"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias $5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "series alias"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "series alias"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias cpu.upc cpu.upc"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_datacenter]]"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias America"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_dc.region.name]]"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Northeast"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_cluster-name]]"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Cluster"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_/cluster/name/]]"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Cluster/"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias [[tag_@cluster@name@]]"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Cluster@"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})

		t.Run("shouldn't parse aliases", func(t *testing.T) {
			query = models.Query{Alias: "alias words with no brackets"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name := "alias words with no brackets"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias Test 1.5"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Test 1.5"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}

			query = models.Query{Alias: "alias Test -1"}
			result = ResponseParse(readJsonFile("response"), 200, generateQuery(query))
			name = "alias Test -1"
			testFrame.Name = name
			testFrame.Fields[1].Config.DisplayNameFromDS = name
			if diff := cmp.Diff(testFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	})

	t.Run("Influxdb response parser with errors", func(t *testing.T) {
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
		result := verifyGoldenResponse(t, "error_response", query, "")

		require.EqualError(t, result.Error, "query-timeout limit exceeded")
	})

	t.Run("Influxdb response parser with top-level error", func(t *testing.T) {
		query := models.Query{}

		result := verifyGoldenResponse(t, "error_on_top_level_response", query, "")

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

	t.Run("InfluxDB returns empty DataResponse when there is empty response", func(t *testing.T) {
		query := models.Query{}
		result := verifyGoldenResponse(t, "empty_response", query, "")
		assert.NotNil(t, result.Frames)
		assert.Equal(t, 0, len(result.Frames))
	})
}

func TestResponseParser_Parse_RetentionPolicy(t *testing.T) {
	t.Run("Influxdb response parser should parse metricFindQueries->SHOW RETENTION POLICIES normally", func(t *testing.T) {
		query := models.Query{RefID: "metricFindQuery", RawQuery: "SHOW RETENTION POLICIES"}
		policyFrame := data.NewFrame("",
			data.NewField("Value", nil, []string{
				"default", "autogen", "bar", "5m_avg", "1m_avg",
			}),
		)

		result := verifyGoldenResponse(t, "retention_policy", query, "")

		if diff := cmp.Diff(policyFrame, result.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestResponseParser_table_format(t *testing.T) {
	t.Run("test table result format parsing", func(t *testing.T) {
		resp := verifyGoldenResponse(t, "simple_response", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
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
		resp := verifyGoldenResponse(t, "multiple_series_with_tags_and_multiple_columns", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
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
		resp := verifyGoldenResponse(t, "multiple_series_with_tags", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
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
		resp := verifyGoldenResponse(t, "one_measurement_with_two_columns", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
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
		resp := verifyGoldenResponse(t, "measurements", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
		assert.Equal(t, 1, len(resp.Frames))
		assert.Equal(t, "a nice query", resp.Frames[0].Meta.ExecutedQueryString)
		for i := range resp.Frames[0].Fields {
			assert.Equal(t, resp.Frames[0].Fields[0].Len(), resp.Frames[0].Fields[i].Len())
		}
		assert.Equal(t, 1, len(resp.Frames[0].Fields))
		assert.Equal(t, "name", resp.Frames[0].Fields[0].Name)
	})

	t.Run("parse retention policy response as table", func(t *testing.T) {
		resp := verifyGoldenResponse(t, "retention_policy", models.Query{RefID: "A", RawQuery: `a nice query`, ResultFormat: "table"}, "table")
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
			input:     "some_values_are_null",
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
			input:     "all_values_are_null",
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
			input:     "simple_response_with_diverse_data_types",
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
			got := verifyGoldenResponse(t, tt.input, models.Query{ResultFormat: tt.resFormat}, tt.resFormat)
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
