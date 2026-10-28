package dashboard

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// causeFields asserts err is a 422 Invalid error and returns its cause field paths.
func causeFields(t *testing.T, err error) []string {
	t.Helper()
	require.Error(t, err)
	require.True(t, apierrors.IsInvalid(err), "expected Invalid error, got %v", err)
	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.Equal(t, int32(http.StatusUnprocessableEntity), se.ErrStatus.Code)
	require.NotNil(t, se.ErrStatus.Details)
	fields := make([]string, 0, len(se.ErrStatus.Details.Causes))
	for _, c := range se.ErrStatus.Details.Causes {
		fields = append(fields, c.Field)
	}
	return fields
}

func TestValidateDashboardPreferencesSpec(t *testing.T) {
	// JSON values of a given size, for the rows about the schema's limits.
	text := func(runes int) string { return strconv.Quote(strings.Repeat("x", runes)) }
	list := func(n int, entry string) string {
		return "[" + strings.Join(slices.Repeat([]string{entry}, n), ",") + "]"
	}

	tests := []struct {
		name       string
		spec       string // JSON, decoded into dashv2beta1.DashboardPreferencesSpec
		wantCauses []string
	}{
		{"empty spec", `{}`, nil},
		{"every field valid", `{
			"userUID": "u1",
			"dashboard": {
				"preload": true,
				"autoRefresh": "1m",
				"autoRefreshIntervals": ["30s", "1m", "5m"],
				"timeRange": {"from": "now-6h", "to": "now"},
				"fiscalYearStartMonth": 11,
				"nowDelay": "1m",
				"hideTimepicker": false,
				"cursorSync": "Tooltip",
				"layout": "AutoGridLayout",
				"autoGrid": {"maxColumnCount": 10, "columnWidthMode": "custom", "columnWidth": 2000, "rowHeightMode": "custom", "rowHeight": 2000, "fillScreen": true}
			},
			"panels": {
				"legend": {"showLegend": true, "placement": "right", "displayMode": "table"},
				"tooltip": {"mode": "multi", "sort": "desc", "hideZeros": true},
				"axis": {"axisPlacement": "left", "axisGridShow": true, "axisBorderShow": false, "axisCenteredZero": true, "scale": "log10"},
				"graph": {"lineInterpolation": "smooth", "lineWidth": 10, "fillOpacity": 100, "gradientMode": "opacity", "showPoints": "always", "pointSize": 40},
				"field": {"decimals": 15},
				"frame": {"transparent": true}
			}
		}`, nil},
		// The schema bounds these at 0; the editor's higher minimums are admission's to enforce.
		{"zeros valid", `{"dashboard":{"fiscalYearStartMonth":0,"autoGrid":{"maxColumnCount":0,"columnWidth":0,"rowHeight":0}},"panels":{"graph":{"lineWidth":0,"fillOpacity":0,"pointSize":0},"field":{"decimals":0}}}`, nil},
		{"every size at its limit", `{"userUID":` + text(40) + `,"dashboard":{"autoRefresh":` + text(32) + `,"autoRefreshIntervals":` + list(30, text(32)) + `,"timeRange":{"from":` + text(64) + `,"to":` + text(64) + `},"nowDelay":` + text(32) + `}}`, nil},

		{"userUID too long", `{"userUID":` + text(41) + `}`, []string{"spec.userUID"}},
		{"autoRefresh too long", `{"dashboard":{"autoRefresh":` + text(33) + `}}`, []string{"spec.dashboard.autoRefresh"}},
		{"time range start too long", `{"dashboard":{"timeRange":{"from":` + text(65) + `,"to":"now"}}}`, []string{"spec.dashboard.timeRange.from"}},
		{"too many refresh intervals", `{"dashboard":{"autoRefreshIntervals":` + list(31, `"1m"`) + `}}`, []string{"spec.dashboard.autoRefreshIntervals"}},
		{"refresh interval too long", `{"dashboard":{"autoRefreshIntervals":["1m",` + text(33) + `]}}`, []string{"spec.dashboard.autoRefreshIntervals.1"}},
		{"empty refresh interval", `{"dashboard":{"autoRefreshIntervals":[""]}}`, []string{"spec.dashboard.autoRefreshIntervals.0"}},
		{"empty now delay", `{"dashboard":{"nowDelay":""}}`, []string{"spec.dashboard.nowDelay"}},

		{"fiscal year start month above 11", `{"dashboard":{"fiscalYearStartMonth":12}}`, []string{"spec.dashboard.fiscalYearStartMonth"}},
		{"max column count above 10", `{"dashboard":{"autoGrid":{"maxColumnCount":11}}}`, []string{"spec.dashboard.autoGrid.maxColumnCount"}},
		{"line width above 10", `{"panels":{"graph":{"lineWidth":11}}}`, []string{"spec.panels.graph.lineWidth"}},
		{"fill opacity above 100", `{"panels":{"graph":{"fillOpacity":101}}}`, []string{"spec.panels.graph.fillOpacity"}},
		{"point size above 40", `{"panels":{"graph":{"pointSize":41}}}`, []string{"spec.panels.graph.pointSize"}},
		{"decimals below 0", `{"panels":{"field":{"decimals":-1}}}`, []string{"spec.panels.field.decimals"}},
		{"decimals above 15", `{"panels":{"field":{"decimals":16}}}`, []string{"spec.panels.field.decimals"}},

		{"unknown cursor sync", `{"dashboard":{"cursorSync":"Bogus"}}`, []string{"spec.dashboard.cursorSync"}},
		{"unknown layout", `{"dashboard":{"layout":"RowsLayout"}}`, []string{"spec.dashboard.layout"}},
		{"unknown column width mode", `{"dashboard":{"autoGrid":{"columnWidthMode":"huge"}}}`, []string{"spec.dashboard.autoGrid.columnWidthMode"}},
		{"unknown row height mode", `{"dashboard":{"autoGrid":{"rowHeightMode":"huge"}}}`, []string{"spec.dashboard.autoGrid.rowHeightMode"}},
		{"unknown legend placement", `{"panels":{"legend":{"placement":"left"}}}`, []string{"spec.panels.legend.placement"}},
		{"unknown legend display mode", `{"panels":{"legend":{"displayMode":"grid"}}}`, []string{"spec.panels.legend.displayMode"}},
		{"unknown tooltip mode", `{"panels":{"tooltip":{"mode":"all"}}}`, []string{"spec.panels.tooltip.mode"}},
		{"unknown tooltip sort", `{"panels":{"tooltip":{"sort":"random"}}}`, []string{"spec.panels.tooltip.sort"}},
		{"unknown axis placement", `{"panels":{"axis":{"axisPlacement":"top"}}}`, []string{"spec.panels.axis.axisPlacement"}},
		{"unknown axis scale", `{"panels":{"axis":{"scale":"log3"}}}`, []string{"spec.panels.axis.scale"}},
		{"unknown line interpolation", `{"panels":{"graph":{"lineInterpolation":"cubic"}}}`, []string{"spec.panels.graph.lineInterpolation"}},
		{"unknown gradient mode", `{"panels":{"graph":{"gradientMode":"rainbow"}}}`, []string{"spec.panels.graph.gradientMode"}},
		{"unknown show points", `{"panels":{"graph":{"showPoints":"sometimes"}}}`, []string{"spec.panels.graph.showPoints"}},

		{"empty time range start", `{"dashboard":{"timeRange":{"from":"","to":"now"}}}`, []string{"spec.dashboard.timeRange.from"}},
		{"time range without end", `{"dashboard":{"timeRange":{"from":"now-1h"}}}`, []string{"spec.dashboard.timeRange.to"}}, // typed To re-marshals as ""
		{"one cause per violation", `{"dashboard":{"cursorSync":"Bogus"},"panels":{"axis":{"scale":"log3"},"field":{"decimals":99}}}`, []string{"spec.dashboard.cursorSync", "spec.panels.axis.scale", "spec.panels.field.decimals"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var spec dashv2beta1.DashboardPreferencesSpec
			require.NoError(t, json.Unmarshal([]byte(tt.spec), &spec))

			err := validateDashboardPreferencesSpec("user-u1", spec)
			if tt.wantCauses == nil {
				require.NoError(t, err)
				return
			}
			require.ElementsMatch(t, tt.wantCauses, causeFields(t, err))
		})
	}
}

func TestValidateDashboardPreferencesSpecErrorNamesTheObject(t *testing.T) {
	err := validateDashboardPreferencesSpec("user-u1", dashv2beta1.DashboardPreferencesSpec{
		Dashboard: &dashv2beta1.DashboardPreferencesDashboardDefaults{FiscalYearStartMonth: new(int64(12))},
	})

	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.NotNil(t, se.ErrStatus.Details)
	require.Equal(t, "dashboard.grafana.app", se.ErrStatus.Details.Group)
	require.Equal(t, "DashboardPreferences", se.ErrStatus.Details.Kind)
	require.Equal(t, "user-u1", se.ErrStatus.Details.Name)
}

func TestValidateDashboardPreferencesSpecFailsClosedWithoutSchema(t *testing.T) {
	buildErr := errors.New("schema unavailable")
	original := dashboardPreferencesSpecSchema
	t.Cleanup(func() { dashboardPreferencesSpecSchema = original })
	dashboardPreferencesSpecSchema = sync.OnceValues(func() (*openapi3.Schema, error) { return nil, buildErr })

	// An empty spec is valid, so only the build error can make this fail.
	err := validateDashboardPreferencesSpec("user-u1", dashv2beta1.DashboardPreferencesSpec{})
	require.ErrorIs(t, err, buildErr)
}

func TestDashboardPreferencesSchemaErrorToFieldWithoutSchemaError(t *testing.T) {
	got := dashboardPreferencesSchemaErrorToField(errors.New("boom"))
	require.Equal(t, "spec", got.Field)
	require.Equal(t, "boom", got.Detail)
}
