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
		"all-panels.json",
		"panel-graph/graph-shared-tooltips.json",
	}

	// key will allow name or uid
	ds := func(ref *DataSourceRef) *DataSourceRef {
		if ref == nil || ref.UID == "" {
			return &DataSourceRef{
				UID:  "default.uid",
				Name: "default.name",
				Type: "default.type",
			}
		}
		return ref
	}

	for _, input := range inputs {
		// nolint:gosec
		// We can ignore the gosec G304 warning because this is a test with hardcoded input values
		f, err := os.Open("../../../../devenv/dev-dashboards/" + input)
		require.NoError(t, err)

		dash := ReadDashboard(f, ds)
		out, err := json.MarshalIndent(dash, "", "  ")
		require.NoError(t, err)

		update := false
		savedPath := "testdata/" + filepath.Base(input)
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
