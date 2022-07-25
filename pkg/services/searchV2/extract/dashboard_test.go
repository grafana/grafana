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

type dsLookup struct {
}

func (d *dsLookup) ByRef(ref *DataSourceRef) *DataSourceRef {
	if ref == nil || ref.UID == "" {
		return &DataSourceRef{
			UID:  "default.uid",
			Type: "default.type",
		}
	}

	if ref.UID == "default" {
		return nil
	}
	return ref
}

func (d *dsLookup) ByType(dsType string) []DataSourceRef {
	if dsType == "sqlite-datasource" {
		return []DataSourceRef{
			{
				UID:  "sqlite-1",
				Type: "sqlite-datasource",
			},
			{
				UID:  "sqlite-2",
				Type: "sqlite-datasource",
			},
		}
	}
	return make([]DataSourceRef, 0)
}

func TestReadDashboard(t *testing.T) {
	inputs := []string{
		"check-string-datasource-id",
		"all-panels",
		"panel-graph/graph-shared-tooltips",
		"datasource-variable",
		"default-datasource-variable",
		"empty-datasource-variable",
		"repeated-datasource-variables",
		"string-datasource-variable",
		"datasource-variable-no-curly-braces",
		"all-selected-multi-datasource-variable",
		"all-selected-single-datasource-variable",
		"repeated-datasource-variables-with-default",
		"mixed-datasource-with-variable",
		"special-datasource-types",
		"panels-without-datasources",
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

		dash, err := ReadDashboard(f, &dsLookup{})
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
