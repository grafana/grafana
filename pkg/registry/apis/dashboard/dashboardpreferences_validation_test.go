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
			"dashboard": {
				"preload": true,
				"autoRefresh": "1m",
				"autoRefreshIntervals": ["30s", "1m", "5m"],
				"timeRange": {"from": "now-6h", "to": "now"},
				"cursorSync": "Tooltip"
			},
			"panels": {
				"legend": {"showLegend": true, "placement": "right", "displayMode": "table"},
				"tooltip": {"mode": "multi", "sort": "desc", "hideZeros": true},
				"field": {"decimals": 15}
			}
		}`, nil},
		{"zero decimals valid", `{"panels":{"field":{"decimals":0}}}`, nil},
		{"every size at its limit", `{"dashboard":{"autoRefresh":` + text(32) + `,"autoRefreshIntervals":` + list(30, text(32)) + `,"timeRange":{"from":` + text(64) + `,"to":` + text(64) + `}}}`, nil},

		{"autoRefresh too long", `{"dashboard":{"autoRefresh":` + text(33) + `}}`, []string{"spec.dashboard.autoRefresh"}},
		{"time range start too long", `{"dashboard":{"timeRange":{"from":` + text(65) + `,"to":"now"}}}`, []string{"spec.dashboard.timeRange.from"}},
		{"too many refresh intervals", `{"dashboard":{"autoRefreshIntervals":` + list(31, `"1m"`) + `}}`, []string{"spec.dashboard.autoRefreshIntervals"}},
		{"refresh interval too long", `{"dashboard":{"autoRefreshIntervals":["1m",` + text(33) + `]}}`, []string{"spec.dashboard.autoRefreshIntervals.1"}},
		{"empty refresh interval", `{"dashboard":{"autoRefreshIntervals":[""]}}`, []string{"spec.dashboard.autoRefreshIntervals.0"}},

		{"decimals below 0", `{"panels":{"field":{"decimals":-1}}}`, []string{"spec.panels.field.decimals"}},
		// Below -1 the value also fails the minimum that the exclusive bound is written with.
		{"decimals below -1", `{"panels":{"field":{"decimals":-2}}}`, []string{"spec.panels.field.decimals"}},
		{"decimals above 15", `{"panels":{"field":{"decimals":16}}}`, []string{"spec.panels.field.decimals"}},

		{"unknown cursor sync", `{"dashboard":{"cursorSync":"Bogus"}}`, []string{"spec.dashboard.cursorSync"}},
		{"unknown legend placement", `{"panels":{"legend":{"placement":"left"}}}`, []string{"spec.panels.legend.placement"}},
		{"unknown legend display mode", `{"panels":{"legend":{"displayMode":"grid"}}}`, []string{"spec.panels.legend.displayMode"}},
		{"unknown tooltip mode", `{"panels":{"tooltip":{"mode":"all"}}}`, []string{"spec.panels.tooltip.mode"}},
		{"unknown tooltip sort", `{"panels":{"tooltip":{"sort":"random"}}}`, []string{"spec.panels.tooltip.sort"}},

		{"empty time range start", `{"dashboard":{"timeRange":{"from":"","to":"now"}}}`, []string{"spec.dashboard.timeRange.from"}},
		{"time range without end", `{"dashboard":{"timeRange":{"from":"now-1h"}}}`, []string{"spec.dashboard.timeRange.to"}}, // typed To re-marshals as ""
		{"one cause per violation", `{"dashboard":{"cursorSync":"Bogus"},"panels":{"legend":{"placement":"left"},"field":{"decimals":99}}}`, []string{"spec.dashboard.cursorSync", "spec.panels.legend.placement", "spec.panels.field.decimals"}},

		// Admission rejects panel paths, but they are valid here like spec.panels.
		{"reset", `{"dashboard":{"preload":true},"panels":{"legend":{"placement":"right"}},"reset":["dashboard.cursorSync","panels.legend.showLegend","panels.field.decimals"]}`, nil},
		{"unknown reset path", `{"reset":["dashboard.title"]}`, []string{"spec.reset.0"}},
		{"reset path listed twice", `{"reset":["dashboard.cursorSync","dashboard.preload","dashboard.cursorSync"]}`, []string{"spec.reset.2"}},
		// The schema already has a cause for the second entry, so the duplicate adds none.
		{"unknown reset path listed twice", `{"reset":["dashboard.title","dashboard.title"]}`, []string{"spec.reset.0", "spec.reset.1"}},
		{"reset of a set field", `{"dashboard":{"cursorSync":"Crosshair"},"reset":["dashboard.cursorSync"]}`, []string{"spec.reset.0"}},
		{"reset of a field set to false", `{"dashboard":{"preload":false},"reset":["dashboard.preload"]}`, []string{"spec.reset.0"}},
		{"reset of a set nested field", `{"panels":{"legend":{"placement":"right"}},"reset":["dashboard.preload","panels.legend.placement"]}`, []string{"spec.reset.1"}},
		{"reset of a set time range", `{"dashboard":{"timeRange":{"from":"now-1h","to":"now"}},"reset":["dashboard.timeRange"]}`, []string{"spec.reset.0"}},
		{"reset of a set panel field", `{"panels":{"field":{"decimals":2}},"reset":["panels.field.decimals"]}`, []string{"spec.reset.0"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var spec dashv2beta1.DashboardPreferencesSpec
			require.NoError(t, json.Unmarshal([]byte(tt.spec), &spec))

			err := validateDashboardPreferencesSpec("user-u1", spec)
			if tt.wantCauses == nil {
				require.NoError(t, err)
				// The typed decode drops a key it doesn't know, so a valid row checks every field it lists only
				// if the spec encodes back to it.
				encoded, err := json.Marshal(spec)
				require.NoError(t, err)
				require.JSONEq(t, tt.spec, string(encoded))
				return
			}
			require.ElementsMatch(t, tt.wantCauses, causeFields(t, err))
		})
	}
}

func TestValidateDashboardPreferencesSpecErrorNamesTheObject(t *testing.T) {
	err := validateDashboardPreferencesSpec("user-u1", dashv2beta1.DashboardPreferencesSpec{
		Panels: &dashv2beta1.DashboardPreferencesPanelDefaults{Field: &dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsField{Decimals: new(int64(16))}},
	})

	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.NotNil(t, se.ErrStatus.Details)
	require.Equal(t, "dashboard.grafana.app", se.ErrStatus.Details.Group)
	require.Equal(t, "DashboardPreferences", se.ErrStatus.Details.Kind)
	require.Equal(t, "user-u1", se.ErrStatus.Details.Name)
}

// The schema checks the exclusive minimum first, and its cause is the one that states the bound right.
func TestValidateDashboardPreferencesSpecKeepsTheFirstCausePerField(t *testing.T) {
	var spec dashv2beta1.DashboardPreferencesSpec
	require.NoError(t, json.Unmarshal([]byte(`{"panels":{"field":{"decimals":-2}}}`), &spec))

	err := validateDashboardPreferencesSpec("user-u1", spec)

	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.NotNil(t, se.ErrStatus.Details)
	require.Len(t, se.ErrStatus.Details.Causes, 1)
	require.Contains(t, se.ErrStatus.Details.Causes[0].Message, "number must be more than -1")
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
