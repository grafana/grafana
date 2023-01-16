package converter

import (
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const update = true

func TestReadPromFrames(t *testing.T) {
	// FIXME:
	// skipping test due to flaky behavior
	t.Skip()
	files := []string{
		"prom-labels",
		"prom-matrix",
		"prom-matrix-with-nans",
		"prom-matrix-histogram-no-labels",
		"prom-matrix-histogram-partitioned",
		"prom-vector-histogram-no-labels",
		"prom-vector",
		"prom-string",
		"prom-scalar",
		"prom-series",
		"prom-warnings",
		"prom-error",
		"prom-exemplars-a",
		"prom-exemplars-b",
		"loki-streams-a",
		"loki-streams-b",
		"loki-streams-c",
	}

	for _, name := range files {
		t.Run(name, runScenario(name, Options{}))
		t.Run(name, runScenario(name, Options{MatrixWideSeries: true, VectorWideSeries: true}))
	}
}

// FIXME:
//
//lint:ignore U1000 Ignore used function for now
func runScenario(name string, opts Options) func(t *testing.T) {
	return func(t *testing.T) {
		// Safe to disable, this is a test.
		// nolint:gosec
		f, err := os.Open(path.Join("testdata", name+".json"))
		require.NoError(t, err)

		if opts.MatrixWideSeries || opts.VectorWideSeries {
			name = name + "-wide"
		}

		iter := jsoniter.Parse(jsoniter.ConfigDefault, f, 1024)
		rsp := ReadPrometheusStyleResult(iter, opts)

		if strings.Contains(name, "error") {
			require.Error(t, rsp.Error)
			return
		}

		fname := name + "-frame"
		experimental.CheckGoldenJSONResponse(t, "testdata", fname, &rsp, update)
	}
}

func TestTimeConversions(t *testing.T) {
	// include millisecond precision
	assert.Equal(t,
		time.Date(2020, time.September, 14, 15, 22, 25, 479000000, time.UTC),
		timeFromFloat(1600096945.479))

	// Loki date parsing
	assert.Equal(t,
		time.Date(2022, time.February, 16, 16, 50, 46, 277587968, time.UTC),
		timeFromLokiString("1645030246277587968"))

	assert.Equal(t,
		time.Date(2033, time.May, 18, 3, 33, 20, 0, time.UTC),
		timeFromLokiString("2000000000000000000"))
}
