package converter

import (
	"io/ioutil"
	"os"
	"path"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadPromFrames(t *testing.T) {
	files := []string{
		"prom-labels",
		"prom-matrix",
		"prom-matrix-with-nans",
		"prom-vector",
		"prom-series",
		"prom-exemplars",
		"loki-streams",
	}

	for _, name := range files {
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			// We can ignore the gosec G304 because this is a test with static defined paths
			f, err := os.Open(path.Join("testdata", name+".json"))
			require.NoError(t, err)

			iter := jsoniter.Parse(jsoniter.ConfigDefault, f, 1024)
			rsp := ReadPrometheusStyleResult(iter)

			out, err := jsoniter.MarshalIndent(rsp, "", "  ")
			require.NoError(t, err)

			save := false
			fpath := path.Join("testdata", name+"-frame.json")

			// nolint:gosec
			// We can ignore the gosec G304 because this is a test with static defined paths
			current, err := ioutil.ReadFile(fpath)
			if err == nil {
				same := assert.JSONEq(t, string(out), string(current))
				if !same {
					save = true
				}
			} else {
				assert.Fail(t, "missing file: "+fpath)
				save = true
			}

			if save {
				err = os.WriteFile(fpath, out, 0600)
				require.NoError(t, err)
			}

			fpath = path.Join("testdata", name+"-golden.txt")
			err = experimental.CheckGoldenDataResponse(fpath, rsp, true)
			assert.NoError(t, err)
		})
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
}
