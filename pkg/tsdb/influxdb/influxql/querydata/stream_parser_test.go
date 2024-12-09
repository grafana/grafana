package querydata

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/influxdata/influxql"
	"github.com/stretchr/testify/require"

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

func generateQuery(query, resFormat, alias string) *models.Query {
	statement, _ := influxql.ParseStatement(query)
	return &models.Query{
		RawQuery:     query,
		UseRawQuery:  true,
		Alias:        alias,
		ResultFormat: resFormat,
		Statement:    statement,
	}
}

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
		f := readJsonFile(tf)

		query := generateQuery("Test raw query", resultFormat, "")

		runQuery(t, f, tf, resultFormat, query)
	}
}

func runQuery(t *testing.T, f io.ReadCloser, tf string, rf string, query *models.Query) {
	rsp := ResponseParse(f, 200, query)

	if strings.Contains(tf, "error") {
		require.Error(t, rsp.Error)
		return
	}
	require.NoError(t, rsp.Error)

	fname := tf + "." + rf + ".golden"
	experimental.CheckGoldenJSONResponse(t, testPath, fname, rsp, shouldUpdate)
}

func TestParsingAsTimeSeriesWithoutTimeColumn(t *testing.T) {
	t.Run("cardinality", func(t *testing.T) {
		f, err := os.Open(path.Join(testPath, filepath.Clean("cardinality.json")))
		require.NoError(t, err)

		query := generateQuery(`SHOW TAG VALUES CARDINALITY with key = "host"`, "time_series", "")

		runQuery(t, f, "cardinality", "time_series", query)
	})

	t.Run("create frames for tag values and without time column even the query string has cardinality as string", func(t *testing.T) {
		res := ResponseParse(readJsonFile("show_tag_values_response"), 200, generateQuery("SHOW TAG VALUES FROM custom_influxdb_cardinality WITH KEY = \"database\"", "time_series", ""))
		require.NoError(t, res.Error)
		require.Equal(t, "Value", res.Frames[0].Fields[0].Name)
		require.Equal(t, "cpu-total", *res.Frames[0].Fields[0].At(0).(*string))
	})
}

func TestInfluxDBStreamingParser(t *testing.T) {
	t.Run("Influxdb response parser with error message", func(t *testing.T) {
		result := ResponseParse(readJsonFile("invalid_response"), 400, generateQuery("Test raw query", "time_series", ""))
		require.Nil(t, result.Frames)
		require.EqualError(t, result.Error, "InfluxDB returned error: failed to parse query: found WERE, expected ; at line 1, char 38")
	})
}
