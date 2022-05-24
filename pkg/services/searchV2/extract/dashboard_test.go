package extract

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadDashboard(t *testing.T) {
	inputs := []string{
		"check-string-datasource-id",
		"all-panels",
		"panel-graph/graph-shared-tooltips",
	}

	// key will allow name or uid
	ds := func(ref *DataSourceRef) *DataSourceRef {
		if ref == nil || ref.UID == "" {
			return &DataSourceRef{
				UID:  "default.uid",
				Type: "default.type",
			}
		}
		return ref
	}

	devdash := "../../../../devenv/dev-dashboards/"

	for _, input := range inputs {
		// nolint:gosec
		// We can ignore the gosec G304 warning because this is a test with hardcoded input values
		f, err := os.Open(filepath.Join(devdash, input) + ".json")
		if err == nil {
			input = "devdash-" + filepath.Base(input)
		}
		if err != nil {
			// nolint:gosec
			// We can ignore the gosec G304 warning because this is a test with hardcoded input values
			f, err = os.Open(filepath.Join("testdata", input) + ".json")
		}
		require.NoError(t, err)

		dash, err := ReadDashboard(f, ds)
		require.NoError(t, err)
		out, err := json.MarshalIndent(dash, "", "  ")
		require.NoError(t, err)

		update := false
		savedPath := filepath.Join("testdata/", input+"-info.json")
		saved, err := os.ReadFile(savedPath)
		if err != nil {
			update = true
			assert.NoError(t, err)
		} else if !assert.JSONEq(t, string(saved), string(out)) {
			update = true
		}

		if update {
			_ = os.WriteFile(savedPath, out, 0600)
		}
	}
}
