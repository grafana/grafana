package dashboard

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func dsLookupForTests() DatasourceLookup {
	return CreateDatasourceLookup([]*DatasourceQueryResult{
		{
			UID:       "P8045C56BDA891CB2",
			Type:      "cloudwatch",
			Name:      "cloudwatch-name",
			IsDefault: false,
		},
		{
			UID:       "PD8C576611E62080A",
			Type:      "testdata",
			Name:      "gdev-testdata",
			IsDefault: false,
		},
		{
			UID:       "dgd92lq7k",
			Type:      "frser-sqlite-datasource",
			Name:      "frser-sqlite-datasource-name",
			IsDefault: false,
		},
		{
			UID:       "sqlite-1",
			Type:      "sqlite-datasource",
			Name:      "SQLite Grafana",
			IsDefault: false,
		},
		{
			UID:       "sqlite-2",
			Type:      "sqlite-datasource",
			Name:      "SQLite Grafana2",
			IsDefault: false,
		},
		{
			UID:       "default.uid",
			Type:      "default.type",
			Name:      "default.name",
			IsDefault: true,
		},
	})
}

func TestReadDashboard(t *testing.T) {
	inputs := []string{
		"absolute-garbage",
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
		"panel-with-library-panel-field",
		"k8s-wrapper",
		"k8s-wrapper-editable-string",
		"k8s-wrapper-tags-string",
		"k8s-wrapper-with-parsing-errors",
		"v2-elements",
		"scenarios/all-colapsed-rows-public",
	}

	devdash := "../../../../../devenv/dev-dashboards/"

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

		dash, err := ReadDashboard(f, dsLookupForTests())
		sortDatasources(dash)

		require.NoError(t, err)
		out, err := json.MarshalIndent(dash, "", "  ")
		require.NoError(t, err)

		update := false
		savedPath := filepath.Join("testdata/", input+"-info.json")
		//nolint:gosec
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

// TestReadV2PanelType ensures the panel type is read from the stable v2 envelope,
// where the plugin id lives in vizConfig.group (kind is the literal "VizConfig"),
// while still falling back to vizConfig.kind for older v2alpha1 dashboards. A
// malformed stable panel (kind "VizConfig", no group) must never index as "VizConfig".
func TestReadV2PanelType(t *testing.T) {
	json := `{"metadata":{"name":"x"},"spec":{"title":"t","elements":{` +
		`"p1":{"kind":"Panel","spec":{"id":1,"vizConfig":{"kind":"VizConfig","group":"timeseries","spec":{}}}},` +
		`"p2":{"kind":"Panel","spec":{"id":2,"vizConfig":{"kind":"text","spec":{}}}},` +
		`"p3":{"kind":"Panel","spec":{"id":3,"vizConfig":{"kind":"VizConfig","spec":{}}}}}}}`

	dash, err := ReadDashboard(strings.NewReader(json), dsLookupForTests())
	require.NoError(t, err)
	require.Len(t, dash.Panels, 3)

	types := map[string]bool{}
	for _, p := range dash.Panels {
		types[p.Type] = true
	}
	assert.True(t, types["timeseries"], "stable v2 panel should index its vizConfig.group, not %q", "VizConfig")
	assert.True(t, types["text"], "v2alpha1 panel should fall back to vizConfig.kind")
	assert.False(t, types["VizConfig"], "panel type must never be the literal VizConfig")
}

// TestReadDashboardRecursionLimits ensures that maliciously deep nesting of `spec` or
// `panels` is bounded so the parser cannot be driven into unbounded recursion.
func TestReadDashboardRecursionLimits(t *testing.T) {
	t.Run("deeply nested spec terminates and does not recurse past the limit", func(t *testing.T) {
		// {"spec":{"spec":{ ... {"title":"deep"} ... }}}
		json := `{"title":"deep"}`
		for i := 0; i < 100; i++ {
			json = `{"spec":` + json + `}`
		}

		dash, err := ReadDashboard(strings.NewReader(json), dsLookupForTests())
		require.NoError(t, err)
		require.NotNil(t, dash)
		// Only one spec is ever followed, so the inner "deep" title is never reached.
		require.Empty(t, dash.Title)
	})

	t.Run("deeply nested panels are bounded by maxPanelDepth", func(t *testing.T) {
		// A chain of nested rows, each carrying the next in its "panels" array.
		panel := `{"type":"row","id":100,"panels":[]}`
		for i := 99; i >= 0; i-- {
			panel = fmt.Sprintf(`{"type":"row","id":%d,"panels":[%s]}`, i, panel)
		}
		json := fmt.Sprintf(`{"title":"nested","panels":[%s]}`, panel)

		dash, err := ReadDashboard(strings.NewReader(json), dsLookupForTests())
		require.NoError(t, err)
		require.NotNil(t, dash)
		require.Len(t, dash.Panels, 1)

		// Walk the Collapsed chain; the depth must be bounded regardless of input depth.
		depth := 0
		for panels := dash.Panels; len(panels) > 0; panels = panels[0].Collapsed {
			depth++
		}
		// The top-level panel is read at depth 0 and may recurse up to maxPanelDepth,
		// yielding maxPanelDepth+1 panel objects in the chain.
		require.Equal(t, maxPanelDepth+1, depth)
	})

	t.Run("a single spec and one-level row nesting parse normally", func(t *testing.T) {
		json := `{"apiVersion":"v1","kind":"Dashboard","metadata":{},"spec":{` +
			`"title":"ok","panels":[{"type":"row","id":1,"panels":[{"type":"timeseries","id":2}]}]}}`

		dash, err := ReadDashboard(strings.NewReader(json), dsLookupForTests())
		require.NoError(t, err)
		require.Equal(t, "ok", dash.Title)
		require.Len(t, dash.Panels, 1)
		require.Len(t, dash.Panels[0].Collapsed, 1)
	})
}

// assure consistent ordering of datasources to prevent random failures of `assert.JSONEq`
func sortDatasources(dash *DashboardSummaryInfo) {
	sort.Slice(dash.Datasource, func(i, j int) bool {
		return strings.Compare(dash.Datasource[i].UID, dash.Datasource[j].UID) > 0
	})

	for panelId := range dash.Panels {
		sort.Slice(dash.Panels[panelId].Datasource, func(i, j int) bool {
			return strings.Compare(dash.Panels[panelId].Datasource[i].UID, dash.Panels[panelId].Datasource[j].UID) > 0
		})
	}
}
