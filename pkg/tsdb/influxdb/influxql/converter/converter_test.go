package converter_test

import (
	"io"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var shouldUpdate = false

const streamParser = true

var files = []string{
	"influx_select_all_from_cpu",
	"select_value_from_cpu",
	"select_multiple_from_cpu",
	"select_multiple_from_cpu_group_by_tag",
	"select_value_from_measurement_with_one_tag",
	"select_value_from_measurement_with_multiple_tags",
	"response_with_nulls",
	"retention_policy",
	"show_measurements",
	"diverse_data_types",
}

var query = &models.Query{
	Measurement:  "",
	Policy:       "",
	Tags:         nil,
	GroupBy:      nil,
	Selects:      nil,
	RawQuery:     "raw query",
	UseRawQuery:  true,
	Alias:        "",
	Interval:     0,
	Tz:           "",
	Limit:        "",
	Slimit:       "",
	OrderByTime:  "",
	RefID:        "",
	ResultFormat: "time_series",
}

func TestReadInfluxAsTimeSeries(t *testing.T) {
	for _, f := range files {
		t.Run(f, runScenario(f, "time_series"))
	}
}

func TestReadInfluxAsTable(t *testing.T) {
	for _, f := range files {
		t.Run(f, runScenario(f, "table"))
	}
}

//lint:ignore U1000 Ignore used function for now
func runScenario(tf string, resultFormat string) func(t *testing.T) {
	return func(t *testing.T) {
		f, err := os.Open(path.Join("testdata", filepath.Clean(tf+".json")))
		require.NoError(t, err)

		var rsp *backend.DataResponse

		query.ResultFormat = resultFormat

		if streamParser {
			rsp = influxql.StreamParse(f, 200, query)
		} else {
			rsp = influxql.ResponseParse(io.NopCloser(f), 200, query)
		}

		if strings.Contains(tf, "error") {
			require.Error(t, rsp.Error)
			return
		}
		require.NoError(t, rsp.Error)

		fname := tf + "." + resultFormat + ".golden"
		experimental.CheckGoldenJSONResponse(t, "testdata", fname, rsp, shouldUpdate)
	}
}
