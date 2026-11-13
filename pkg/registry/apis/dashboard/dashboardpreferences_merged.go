package dashboard

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// Every field a tier can set or reset. TestDashboardPreferencesFieldPathsMatchSchema keeps it in step with the
// schema's reset paths.
var dashboardPreferencesFieldPaths = []dashv2beta1.DashboardPreferencesResetPath{
	dashv2beta1.DashboardPreferencesResetPathDashboardPreload,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefresh,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefreshIntervals,
	dashv2beta1.DashboardPreferencesResetPathDashboardTimeRange,
	dashv2beta1.DashboardPreferencesResetPathDashboardFiscalYearStartMonth,
	dashv2beta1.DashboardPreferencesResetPathDashboardNowDelay,
	dashv2beta1.DashboardPreferencesResetPathDashboardHideTimepicker,
	dashv2beta1.DashboardPreferencesResetPathDashboardCursorSync,
	dashv2beta1.DashboardPreferencesResetPathDashboardLayout,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridMaxColumnCount,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridColumnWidthMode,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridColumnWidth,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridRowHeightMode,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridRowHeight,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoGridFillScreen,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendShowLegend,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendPlacement,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendDisplayMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipSort,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipHideZeros,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisPlacement,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisGridShow,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisBorderShow,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisAxisCenteredZero,
	dashv2beta1.DashboardPreferencesResetPathPanelsAxisScale,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphLineInterpolation,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphLineWidth,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphFillOpacity,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphGradientMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphShowPoints,
	dashv2beta1.DashboardPreferencesResetPathPanelsGraphPointSize,
	dashv2beta1.DashboardPreferencesResetPathPanelsFieldDecimals,
	dashv2beta1.DashboardPreferencesResetPathPanelsFrameTransparent,
}

// dashboardPreferencesMergeTier is one stored tier, in the order a merge consults them.
type dashboardPreferencesMergeTier struct {
	tier dashboardPreferencesTier
	// Left out of sources when empty.
	name string
	spec dashv2beta1.DashboardPreferencesSpec
}

// tiers are in descending priority. Each field comes from the first tier that sets or resets it, where set means
// what it means to admission: the field is present in the encoded spec.
func mergeDashboardPreferences(tiers []dashboardPreferencesMergeTier) (*dashv2beta1.DashboardPreferencesMerged, error) {
	encoded := make([]any, len(tiers))
	for i, t := range tiers {
		spec := t.spec
		spec.Reset = nil
		raw, err := json.Marshal(spec)
		if err != nil {
			return nil, fmt.Errorf("error marshaling dashboard preferences spec: %w", err)
		}
		// Numbers stay json.Number, so an integer is written back exactly.
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err = decoder.Decode(&encoded[i]); err != nil {
			return nil, fmt.Errorf("error decoding dashboard preferences spec: %w", err)
		}
	}

	values := map[string]any{}
	sources := map[string]dashv2beta1.DashboardPreferencesMergedSource{}
	for _, path := range dashboardPreferencesFieldPaths {
		for i, t := range tiers {
			reset := slices.Contains(t.spec.Reset, path)
			value, set := dashboardPreferencesFieldValue(encoded[i], string(path))
			if !reset && !set {
				continue
			}
			// Validation keeps a tier from both setting and resetting a field. If a stored tier does both,
			// the reset wins, because a reset field is absent from the merged spec.
			if !reset {
				setDashboardPreferencesField(values, string(path), value)
			}
			sources[string(path)] = dashv2beta1.DashboardPreferencesMergedSource{
				Tier:  dashv2beta1.DashboardPreferencesMergedTier(t.tier),
				Name:  t.name,
				Reset: reset,
			}
			break
		}
	}

	merged := &dashv2beta1.DashboardPreferencesMerged{
		TypeMeta: metav1.TypeMeta{APIVersion: dashv2beta1.APIVERSION, Kind: dashv2beta1.DashboardPreferencesMergedKind},
		Sources:  sources,
	}
	raw, err := json.Marshal(values)
	if err != nil {
		return nil, fmt.Errorf("error marshaling merged dashboard preferences spec: %w", err)
	}
	if err = json.Unmarshal(raw, &merged.Spec); err != nil {
		return nil, fmt.Errorf("error decoding merged dashboard preferences spec: %w", err)
	}
	return merged, nil
}

// setDashboardPreferencesField creates parent objects only when it writes, so a field that no tier sets leaves no
// empty object behind.
func setDashboardPreferencesField(values map[string]any, path string, value any) {
	keys := strings.Split(path, ".")
	obj := values
	for _, key := range keys[:len(keys)-1] {
		child, ok := obj[key].(map[string]any)
		if !ok {
			child = map[string]any{}
			obj[key] = child
		}
		obj = child
	}
	obj[keys[len(keys)-1]] = value
}
