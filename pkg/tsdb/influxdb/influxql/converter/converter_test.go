package converter_test

import (
	"io"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/converter"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const update = true
const streamParser = false

type testFile struct {
	fileName string
	rawQuery string
}

var files = []testFile{
	{
		fileName: "influx_select_all_from_cpu",
		rawQuery: "select_all from cpu",
	},
	{
		fileName: "select_value_from_cpu",
		rawQuery: "select_value from cpu",
	},
	{
		fileName: "select_multiple_from_cpu",
		rawQuery: "select_multiple values from cpu",
	},
	{
		fileName: "select_multiple_from_cpu_group_by_tag",
		rawQuery: "select_multiple values from cpu grouped by a tag",
	},
}

func TestReadPromFrames(t *testing.T) {
	for _, f := range files {
		t.Run(f.fileName, runScenario(f))
	}
}

//lint:ignore U1000 Ignore used function for now
func runScenario(tf testFile) func(t *testing.T) {
	return func(t *testing.T) {
		// Safe to disable, this is a test.
		// nolint:gosec
		f, err := os.Open(path.Join("testdata", tf.fileName+".json"))
		require.NoError(t, err)

		shouldUpdate := update
		var rsp backend.DataResponse

		if streamParser {
			shouldUpdate = false
			iter := jsoniter.Parse(jsoniter.ConfigDefault, f, 1024)
			rsp = converter.ReadInfluxQLStyleResult(iter)
		} else {
			rsp = *influxql.ResponseParse(io.NopCloser(f), 200, &models.Query{
				Measurement:  "",
				Policy:       "",
				Tags:         nil,
				GroupBy:      nil,
				Selects:      nil,
				RawQuery:     tf.rawQuery,
				UseRawQuery:  true,
				Alias:        "",
				Interval:     0,
				Tz:           "",
				Limit:        "",
				Slimit:       "",
				OrderByTime:  "",
				RefID:        "",
				ResultFormat: "time_series",
			})
		}

		if strings.Contains(tf.fileName, "error") {
			require.Error(t, rsp.Error)
			return
		}
		require.NoError(t, rsp.Error)

		fname := tf.fileName + "-frame"
		experimental.CheckGoldenJSONResponse(t, "testdata", fname, &rsp, shouldUpdate)
	}
}
