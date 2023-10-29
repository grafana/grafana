package converter

import (
	"os"
	"path"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/require"
)

const update = true

var files = []string{
	"influx_select_all_from_cpu",
	"influx_select_value_from_any",
}

func TestReadPromFrames(t *testing.T) {
	for _, name := range files {
		t.Run(name, runScenario(name))
	}
}

//lint:ignore U1000 Ignore used function for now
func runScenario(name string) func(t *testing.T) {
	return func(t *testing.T) {
		// Safe to disable, this is a test.
		// nolint:gosec
		f, err := os.Open(path.Join("testdata", name+".json"))
		require.NoError(t, err)

		iter := jsoniter.Parse(jsoniter.ConfigDefault, f, 1024)
		rsp := ReadInfluxQLStyleResult(iter)

		if strings.Contains(name, "error") {
			require.Error(t, rsp.Error)
			return
		}
		require.NoError(t, rsp.Error)

		fname := name + "-frame"
		experimental.CheckGoldenJSONResponse(t, "testdata", fname, &rsp, update)
	}
}
