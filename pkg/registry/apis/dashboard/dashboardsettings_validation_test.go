package dashboard

import (
	"encoding/json"
	"errors"
	"net/http"
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

func TestValidateDashboardSettingsSpec(t *testing.T) {
	tests := []struct {
		name       string
		spec       string // JSON, decoded into dashv2beta1.DashboardSettingsSpec
		wantCauses []string
	}{
		{"empty spec", `{}`, nil},
		{"every field valid", `{"preload":true,"autoRefresh":"1m","timeRange":{"from":"now-1h","to":"now"},"cursorSync":"Crosshair","layout":"AutoGridLayout","panels":{"width":2,"legendPlacement":"right","tooltipMode":"multi","axisScale":"log2","decimals":15}}`, nil},
		{"decimals zero", `{"panels":{"decimals":0}}`, nil},
		{"decimals above 15", `{"panels":{"decimals":99}}`, []string{"spec.panels.decimals"}},
		{"decimals below 0", `{"panels":{"decimals":-1}}`, []string{"spec.panels.decimals"}},
		{"unknown axis scale", `{"panels":{"axisScale":"log3"}}`, []string{"spec.panels.axisScale"}},
		{"unknown legend placement", `{"panels":{"legendPlacement":"left"}}`, []string{"spec.panels.legendPlacement"}},
		{"unknown tooltip mode", `{"panels":{"tooltipMode":"all"}}`, []string{"spec.panels.tooltipMode"}},
		{"unknown cursor sync", `{"cursorSync":"Bogus"}`, []string{"spec.cursorSync"}},
		{"unknown layout", `{"layout":"RowsLayout"}`, []string{"spec.layout"}},
		{"empty time range start", `{"timeRange":{"from":"","to":"now"}}`, []string{"spec.timeRange.from"}},
		{"time range without end", `{"timeRange":{"from":"now-1h"}}`, []string{"spec.timeRange.to"}}, // typed To re-marshals as ""
		{"one cause per violation", `{"cursorSync":"Bogus","panels":{"axisScale":"log3","decimals":99}}`, []string{"spec.cursorSync", "spec.panels.axisScale", "spec.panels.decimals"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var spec dashv2beta1.DashboardSettingsSpec
			require.NoError(t, json.Unmarshal([]byte(tt.spec), &spec))

			err := validateDashboardSettingsSpec("user-u1", spec)
			if tt.wantCauses == nil {
				require.NoError(t, err)
				return
			}
			require.ElementsMatch(t, tt.wantCauses, causeFields(t, err))
		})
	}
}

func TestValidateDashboardSettingsSpecErrorNamesTheObject(t *testing.T) {
	err := validateDashboardSettingsSpec("user-u1", dashv2beta1.DashboardSettingsSpec{
		Panels: &dashv2beta1.DashboardSettingsPanelDefaults{Decimals: new(int64(99))},
	})

	var se *apierrors.StatusError
	require.ErrorAs(t, err, &se)
	require.NotNil(t, se.ErrStatus.Details)
	require.Equal(t, "dashboard.grafana.app", se.ErrStatus.Details.Group)
	require.Equal(t, "DashboardSettings", se.ErrStatus.Details.Kind)
	require.Equal(t, "user-u1", se.ErrStatus.Details.Name)
}

func TestValidateDashboardSettingsSpecFailsClosedWithoutSchema(t *testing.T) {
	buildErr := errors.New("schema unavailable")
	original := dashboardSettingsSpecSchema
	t.Cleanup(func() { dashboardSettingsSpecSchema = original })
	dashboardSettingsSpecSchema = sync.OnceValues(func() (*openapi3.Schema, error) { return nil, buildErr })

	// An empty spec is valid, so only the build error can make this fail.
	err := validateDashboardSettingsSpec("user-u1", dashv2beta1.DashboardSettingsSpec{})
	require.ErrorIs(t, err, buildErr)
}

func TestDashboardSettingsSchemaErrorToFieldWithoutSchemaError(t *testing.T) {
	got := dashboardSettingsSchemaErrorToField(errors.New("boom"))
	require.Equal(t, "spec", got.Field)
	require.Equal(t, "boom", got.Detail)
}
