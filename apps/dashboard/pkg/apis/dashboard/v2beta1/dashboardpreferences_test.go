package v2beta1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Guards "absent field = inherit": a CUE default would make the generated constructors write a value.
func TestNewDashboardPreferencesSpecHasNoDefaults(t *testing.T) {
	for _, v := range []any{
		NewDashboardPreferencesSpec(),
		NewDashboardPreferences().Spec,
		NewDashboardPreferencesDashboardDefaults(),
		NewDashboardPreferencesV2beta1DashboardDefaultsAutoGrid(),
		NewDashboardPreferencesPanelDefaults(),
		NewDashboardPreferencesV2beta1PanelDefaultsLegend(),
		NewDashboardPreferencesV2beta1PanelDefaultsTooltip(),
		NewDashboardPreferencesV2beta1PanelDefaultsAxis(),
		NewDashboardPreferencesV2beta1PanelDefaultsGraph(),
		NewDashboardPreferencesV2beta1PanelDefaultsField(),
		NewDashboardPreferencesV2beta1PanelDefaultsFrame(),
	} {
		b, err := json.Marshal(v)
		require.NoError(t, err)
		require.JSONEq(t, `{}`, string(b))
	}

	// from and to are required, so their zero values are expected; anything else is a CUE default.
	b, err := json.Marshal(NewDashboardPreferencesV2beta1DashboardDefaultsTimeRange())
	require.NoError(t, err)
	require.JSONEq(t, `{"from":"","to":""}`, string(b))
}

func TestDashboardPreferencesResourceInfo(t *testing.T) {
	require.Equal(t, schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v2beta1", Resource: "dashboardpreferences"}, DashboardPreferencesResourceInfo.GroupVersionResource())
	require.Equal(t, "dashboardpreferences", DashboardPreferencesResourceInfo.GetSingularName())
	require.Equal(t, "DashboardPreferences", DashboardPreferencesResourceInfo.GroupVersionKind().Kind)
}

func TestDashboardPreferencesNames(t *testing.T) {
	require.Equal(t, "namespace", DashboardPreferencesOrgName)
	require.Equal(t, "folder-a--b", DashboardPreferencesFolderName("a--b"))
	require.Equal(t, "user-u1", DashboardPreferencesUserName("u1"))
}
