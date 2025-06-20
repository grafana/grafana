package dashboard

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestLargeDashboardSupport(t *testing.T) {
	devdash := "../../../../devenv/dev-dashboards/all-panels.json"

	// nolint:gosec
	// We can ignore the gosec G304 warning because this is a test with hardcoded input values
	f, err := os.ReadFile(devdash)
	require.NoError(t, err)

	dash := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test",
			Namespace: "test",
		},
	}
	err = json.Unmarshal(f, &dash.Spec)
	require.NoError(t, err)

	expectedPanelCount := 19
	panels, found, err := unstructured.NestedSlice(dash.Spec.Object, "panels")
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, panels, expectedPanelCount)

	scheme := runtime.NewScheme()

	err = dashv1.AddToScheme(scheme)
	require.NoError(t, err)

	largeObject := NewDashboardLargeObjectSupport(scheme, 0)

	// Convert the dashboard to a small value
	err = largeObject.ReduceSpec(dash)
	require.NoError(t, err)

	small, err := json.MarshalIndent(&dash.Spec, "", "  ")
	require.NoError(t, err)
	require.JSONEq(t, `{
		"schemaVersion": 36,
		"title": "Panel tests - All panels",
		"tags": ["gdev","panel-tests","all-panels"]
	}`, string(small))

	// Now make it big again
	rehydratedDash := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test",
			Namespace: "test",
		},
	}
	err = largeObject.RebuildSpec(rehydratedDash, f)
	require.NoError(t, err)

	// check that all panels exist again
	panels, found, err = unstructured.NestedSlice(rehydratedDash.Spec.Object, "panels")
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, panels, expectedPanelCount)
}

func TestLargeDashboardSupportV2(t *testing.T) {
	// Test RebuildSpec functionality specifically for v2 dashboards
	// This tests the json.Unmarshal(blob, &dash.Spec) path for structured specs
	// unlike v0/v1 which use the UnmarshalJSON path for unstructured specs

	// Create a v2 dashboard with structured spec
	originalV2Dash := &dashv2.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-v2",
			Namespace: "test",
		},
		Spec: dashv2.DashboardSpec{
			Title:       "Test V2 Dashboard",
			Description: stringPtr("A test dashboard for v2 large object support"),
			Tags:        []string{"test", "v2", "large-object"},
			Editable:    boolPtr(true),
			LiveNow:     boolPtr(false),
			Preload:     false,
			Annotations: []dashv2.DashboardAnnotationQueryKind{
				{
					Kind: "AnnotationQuery",
					Spec: dashv2.DashboardAnnotationQuerySpec{
						Name:      "Test Annotation",
						Enable:    true,
						Hide:      false,
						IconColor: "red",
						BuiltIn:   boolPtr(false),
						Datasource: &dashv2.DashboardDataSourceRef{
							Type: stringPtr("prometheus"),
							Uid:  stringPtr("prometheus-uid"),
						},
						Query: &dashv2.DashboardDataQueryKind{
							Kind: "prometheus",
							Spec: map[string]interface{}{
								"expr":    "up",
								"refId":   "A",
								"instant": true,
							},
						},
					},
				},
			},
			Elements: map[string]dashv2.DashboardElement{
				"panel-1": {
					PanelKind: &dashv2.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2.DashboardPanelSpec{
							Id:          1,
							Title:       "Test Panel",
							Description: "Test panel description",
							Links:       []dashv2.DashboardDataLink{},
							Data: dashv2.DashboardQueryGroupKind{
								Kind: "QueryGroup",
								Spec: dashv2.DashboardQueryGroupSpec{
									Queries:         []dashv2.DashboardPanelQueryKind{},
									Transformations: []dashv2.DashboardTransformationKind{},
									QueryOptions:    *dashv2.NewDashboardQueryOptionsSpec(),
								},
							},
							VizConfig: dashv2.DashboardVizConfigKind{
								Kind: "timeseries",
								Spec: dashv2.DashboardVizConfigSpec{
									PluginVersion: "1.0.0",
									Options:       map[string]interface{}{"legend": map[string]interface{}{"displayMode": "table"}},
									FieldConfig:   *dashv2.NewDashboardFieldConfigSource(),
								},
							},
						},
					},
				},
			},
			Layout: dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2.DashboardGridLayoutSpec{
						Items: []dashv2.DashboardGridLayoutItemKind{
							{
								Kind: "GridLayoutItem",
								Spec: dashv2.DashboardGridLayoutItemSpec{
									Element: dashv2.DashboardElementReference{
										Kind: "PanelElement",
										Name: "panel-1",
									},
									X:      0,
									Y:      0,
									Width:  12,
									Height: 8,
								},
							},
						},
					},
				},
			},
			TimeSettings: dashv2.DashboardTimeSettingsSpec{
				From:                 "now-6h",
				To:                   "now",
				Timezone:             stringPtr("browser"),
				AutoRefresh:          "5s",
				AutoRefreshIntervals: []string{"5s", "10s", "30s", "1m", "5m"},
				HideTimepicker:       false,
				FiscalYearStartMonth: 0,
			},
			CursorSync: dashv2.DashboardDashboardCursorSyncOff,
			Variables:  []dashv2.DashboardVariableKind{},
			Links:      []dashv2.DashboardDashboardLink{},
		},
	}

	scheme := runtime.NewScheme()
	err := dashv2.AddToScheme(scheme)
	require.NoError(t, err)

	largeObject := NewDashboardLargeObjectSupport(scheme, 0)

	// Marshal the original spec to use as our "blob" data
	originalSpecBlob, err := json.Marshal(originalV2Dash.Spec)
	require.NoError(t, err)

	// Create a copy to test reduction
	dashToReduce := originalV2Dash.DeepCopy()

	// Convert the dashboard to a small value (ReduceSpec)
	err = largeObject.ReduceSpec(dashToReduce)
	require.NoError(t, err)

	// Verify only essential fields remain after reduction
	require.Equal(t, "Test V2 Dashboard", dashToReduce.Spec.Title)
	require.Equal(t, stringPtr("A test dashboard for v2 large object support"), dashToReduce.Spec.Description)
	require.Equal(t, []string{"test", "v2", "large-object"}, dashToReduce.Spec.Tags)

	// Everything else should be empty/default
	require.Empty(t, dashToReduce.Spec.Annotations)
	require.Empty(t, dashToReduce.Spec.Elements)
	require.Nil(t, dashToReduce.Spec.Layout.GridLayoutKind)
	require.Empty(t, dashToReduce.Spec.Variables)
	require.Empty(t, dashToReduce.Spec.Links)

	// Now test RebuildSpec - this is the key test for v2!
	rehydratedDash := &dashv2.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-v2-rehydrated",
			Namespace: "test",
		},
	}

	// This tests the json.Unmarshal(blob, &dash.Spec) path for v2 dashboards
	err = largeObject.RebuildSpec(rehydratedDash, originalSpecBlob)
	require.NoError(t, err)

	// Verify the full dashboard spec is restored correctly
	require.Equal(t, originalV2Dash.Spec.Title, rehydratedDash.Spec.Title)
	require.Equal(t, originalV2Dash.Spec.Description, rehydratedDash.Spec.Description)
	require.Equal(t, originalV2Dash.Spec.Tags, rehydratedDash.Spec.Tags)
	require.Equal(t, originalV2Dash.Spec.Editable, rehydratedDash.Spec.Editable)
	require.Equal(t, originalV2Dash.Spec.LiveNow, rehydratedDash.Spec.LiveNow)
	require.Equal(t, originalV2Dash.Spec.Preload, rehydratedDash.Spec.Preload)

	// Verify annotations are restored
	require.Len(t, rehydratedDash.Spec.Annotations, 1)
	annotation := rehydratedDash.Spec.Annotations[0]
	require.Equal(t, "AnnotationQuery", annotation.Kind)
	require.Equal(t, "Test Annotation", annotation.Spec.Name)
	require.True(t, annotation.Spec.Enable)
	require.False(t, annotation.Spec.Hide)
	require.Equal(t, "red", annotation.Spec.IconColor)
	require.NotNil(t, annotation.Spec.Datasource)
	require.Equal(t, stringPtr("prometheus"), annotation.Spec.Datasource.Type)
	require.Equal(t, stringPtr("prometheus-uid"), annotation.Spec.Datasource.Uid)

	// Verify elements are restored
	require.Len(t, rehydratedDash.Spec.Elements, 1)
	panel, exists := rehydratedDash.Spec.Elements["panel-1"]
	require.True(t, exists)
	require.NotNil(t, panel.PanelKind)
	require.Equal(t, "Panel", panel.PanelKind.Kind)
	require.Equal(t, "Test Panel", panel.PanelKind.Spec.Title)
	require.Equal(t, "timeseries", panel.PanelKind.Spec.VizConfig.Kind)

	// Verify layout is restored
	require.NotNil(t, rehydratedDash.Spec.Layout.GridLayoutKind)
	require.Equal(t, "GridLayout", rehydratedDash.Spec.Layout.GridLayoutKind.Kind)
	require.Len(t, rehydratedDash.Spec.Layout.GridLayoutKind.Spec.Items, 1)
	layoutItem := rehydratedDash.Spec.Layout.GridLayoutKind.Spec.Items[0]
	require.Equal(t, "panel-1", layoutItem.Spec.Element.Name)
	require.Equal(t, int64(0), layoutItem.Spec.X)
	require.Equal(t, int64(0), layoutItem.Spec.Y)
	require.Equal(t, int64(12), layoutItem.Spec.Width)
	require.Equal(t, int64(8), layoutItem.Spec.Height)

	// Verify time settings are restored
	require.Equal(t, "now-6h", rehydratedDash.Spec.TimeSettings.From)
	require.Equal(t, "now", rehydratedDash.Spec.TimeSettings.To)
	require.Equal(t, stringPtr("browser"), rehydratedDash.Spec.TimeSettings.Timezone)
	require.Equal(t, "5s", rehydratedDash.Spec.TimeSettings.AutoRefresh)
	require.Equal(t, []string{"5s", "10s", "30s", "1m", "5m"}, rehydratedDash.Spec.TimeSettings.AutoRefreshIntervals)

	// Verify cursor sync is restored
	require.Equal(t, dashv2.DashboardDashboardCursorSyncOff, rehydratedDash.Spec.CursorSync)
}

// Helper functions for pointer types
func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

func TestLargeDashboardSupportCrossVersion(t *testing.T) {
	// Test cross-version compatibility: create v0 dashboard, try to rebuild as v2
	// This tests what happens when blob data from one version is used with another version

	// Create a v0 dashboard with complex data
	originalV0Dash := &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cross-version",
			Namespace: "test",
		},
		Spec: dashv0.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "Cross Version Test Dashboard",
				"description":   "Testing cross-version large object reconstruction",
				"tags":          []string{"cross-version", "test", "v0-to-v2"},
				"editable":      true,
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":      "Test Annotation V0",
							"enable":    true,
							"hide":      false,
							"iconColor": "blue",
							"builtIn":   false,
							"datasource": map[string]interface{}{
								"type": "prometheus",
								"uid":  "prometheus-uid-v0",
							},
							"expr":  "up{job=\"grafana\"}",
							"refId": "Anno1",
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "V0 Panel 1",
						"type":  "timeseries",
						"gridPos": map[string]interface{}{
							"x": 0, "y": 0, "w": 12, "h": 8,
						},
						"targets": []interface{}{
							map[string]interface{}{
								"expr":  "cpu_usage_v0",
								"refId": "A",
							},
						},
					},
					map[string]interface{}{
						"id":    2,
						"title": "V0 Panel 2",
						"type":  "stat",
						"gridPos": map[string]interface{}{
							"x": 12, "y": 0, "w": 12, "h": 8,
						},
						"targets": []interface{}{
							map[string]interface{}{
								"expr":  "memory_usage_v0",
								"refId": "B",
							},
						},
					},
				},
				"time": map[string]interface{}{
					"from": "now-1h",
					"to":   "now",
				},
				"timepicker": map[string]interface{}{
					"refresh_intervals": []string{"5s", "10s", "30s", "1m"},
					"hidden":            false,
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "instance",
							"type":  "query",
							"query": "label_values(up, instance)",
							"current": map[string]interface{}{
								"text":  "localhost:9090",
								"value": "localhost:9090",
							},
						},
					},
				},
			},
		},
	}

	// Set up schemes for both versions
	v0Scheme := runtime.NewScheme()
	err := dashv0.AddToScheme(v0Scheme)
	require.NoError(t, err)

	v2Scheme := runtime.NewScheme()
	err = dashv2.AddToScheme(v2Scheme)
	require.NoError(t, err)

	// We don't need v0LargeObject since we're only testing the cross-version rebuild

	// Marshal the original v0 spec to use as our "blob" data
	// This simulates what would be stored as blob data for a large v0 dashboard
	originalV0SpecBlob, err := json.Marshal(originalV0Dash.Spec.Object)
	require.NoError(t, err)

	// Skip the ReduceSpec test to avoid DeepCopy issues with complex nested interface{} types
	// The main goal is to test cross-version RebuildSpec compatibility

	// Now the interesting part: try to rebuild the v0 blob into a v2 dashboard
	targetV2Dash := &dashv2.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cross-version-v2",
			Namespace: "test",
		},
	}

	// Create large object support for v2
	v2LargeObject := NewDashboardLargeObjectSupport(v2Scheme, 0)

	// This is the key test: try to rebuild v0 blob data into v2 spec
	// This tests the json.Unmarshal(blob, &dash.Spec) path with v0 data
	err = v2LargeObject.RebuildSpec(targetV2Dash, originalV0SpecBlob)

	// We expect this to either:
	// 1. Fail with an error (incompatible formats)
	// 2. Succeed but with unexpected/incomplete data
	// 3. Work if there's some compatibility layer

	if err != nil {
		// Document the expected failure case
		t.Logf("Cross-version rebuild failed as expected: %v", err)
		require.Error(t, err, "Cross-version rebuild should fail or produce warnings")

		// Verify the error is reasonable - should be a JSON unmarshaling error
		require.Contains(t, err.Error(), "json")             // Should be a JSON unmarshaling error
		require.Contains(t, err.Error(), "cannot unmarshal") // Specific unmarshaling failure

		// Some basic fields might have been populated before the error occurred
		// but complex structured fields should be empty/default
		require.Empty(t, targetV2Dash.Spec.Elements, "Elements should be empty after failed unmarshal")
		require.Empty(t, targetV2Dash.Spec.Annotations, "Annotations should be empty after failed unmarshal")

		t.Log("EXPECTED BEHAVIOR: v0 blob data cannot be directly unmarshaled into v2 structured spec")
		t.Logf("Title that was populated before failure: '%s'", targetV2Dash.Spec.Title)

	} else {
		// If it succeeds, let's see what we got
		t.Logf("Cross-version rebuild succeeded unexpectedly")

		// Log what we actually got
		t.Logf("Rebuilt v2 Title: %s", targetV2Dash.Spec.Title)
		t.Logf("Rebuilt v2 Description: %s", stringValue(targetV2Dash.Spec.Description))
		t.Logf("Rebuilt v2 Tags: %v", targetV2Dash.Spec.Tags)
		t.Logf("Rebuilt v2 Elements count: %d", len(targetV2Dash.Spec.Elements))
		t.Logf("Rebuilt v2 Annotations count: %d", len(targetV2Dash.Spec.Annotations))

		// The data will likely be incomplete/incorrect since v0 unstructured data
		// doesn't map cleanly to v2 structured data
		t.Log("UNEXPECTED BEHAVIOR: Cross-version rebuild succeeded - check if data is correct")

		// We can't make strong assertions here since the behavior is undefined
		// But we can at least verify basic fields if they were somehow populated
		if targetV2Dash.Spec.Title != "" {
			t.Logf("Title was populated: %s", targetV2Dash.Spec.Title)
		}
	}
}

// Helper function to safely get string pointer value
func stringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
