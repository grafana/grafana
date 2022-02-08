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

	for _, input := range inputs {
		f, err := os.Open("../../../../devenv/dev-dashboards/" + input)
		require.NoError(t, err)

		// key will allow name or uid
		ds := func(key string) *datasourceInfo {
			return nil // TODO!
		}

		dash := readDashboard(f, ds)
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
