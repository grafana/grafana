package extract

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadQuery(t *testing.T) {
	inputs := []string{
		"example-query",
	}

	devdash := "../../../../devenv/dev-dashboards/"

	for _, input := range inputs {
		// nolint:gosec
		// We can ignore the gosec G304 warning because this is a test with hardcoded input values
		path := filepath.Join(devdash, input) + ".json"
		f, err := os.Open(filepath.Join(devdash, input) + ".json")
		if err == nil {
			input = "devdash-" + filepath.Base(input)
		}
		if err != nil {
			// nolint:gosec
			// We can ignore the gosec G304 warning because this is a test with hardcoded input values
			path = filepath.Join("testdata", "queries", input) + ".json"
			f, err = os.Open(path)
		}
		require.NoError(t, err)

		query, err := ReadQuery(f, path, dsLookup())
		sortDatasourcesInQuery(query)

		require.NoError(t, err)
		out, err := json.MarshalIndent(query, "", "  ")
		require.NoError(t, err)

		update := false
		savedPath := filepath.Join("testdata/queries/", input+"-info.json")
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

// assure consistent ordering of datasources to prevent random failures of `assert.JSONEq`
func sortDatasourcesInQuery(dash *QueryInfo) {
	sort.Slice(dash.Datasource, func(i, j int) bool {
		return strings.Compare(dash.Datasource[i].UID, dash.Datasource[j].UID) > 0
	})
}
