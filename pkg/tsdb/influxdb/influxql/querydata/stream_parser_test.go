package querydata

import (
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const (
	shouldUpdate = false
	testPath     = "../testdata"
)

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

		var rsp *backend.DataResponse

		query := &models.Query{
			RawQuery:     "Test raw query",
			UseRawQuery:  true,
			ResultFormat: resultFormat,
		}

		rsp = ResponseParse(f, 200, query)

		if strings.Contains(tf, "error") {
			require.Error(t, rsp.Error)
			return
		}
		require.NoError(t, rsp.Error)

		fname := tf + "." + resultFormat + ".golden"
		experimental.CheckGoldenJSONResponse(t, testPath, fname, rsp, shouldUpdate)
	}
}
