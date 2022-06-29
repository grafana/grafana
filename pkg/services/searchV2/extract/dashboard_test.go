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

func TestReadDashboard(t *testing.T) {
	inputs := []string{
		"check-string-datasource-id",
		"all-panels",
		"panel-graph/graph-shared-tooltips",
		"datasource-variable",
		"empty-datasource-variable",
		"repeated-datasource-variables",
		"string-datasource-variable",
		"datasource-variable-no-curly-braces",
		"all-selected-datasource-variable",
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
		sortDatasources(dash)

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

// assure consistent ordering of datasources to prevent random failures of `assert.JSONEq`
func sortDatasources(dash *DashboardInfo) {
	sort.Slice(dash.Datasource, func(i, j int) bool {
		return strings.Compare(dash.Datasource[i].UID, dash.Datasource[j].UID) > 0
	})

	for panelId := range dash.Panels {
		sort.Slice(dash.Panels[panelId].Datasource, func(i, j int) bool {
			return strings.Compare(dash.Panels[panelId].Datasource[i].UID, dash.Panels[panelId].Datasource[j].UID) > 0
		})
	}
}
