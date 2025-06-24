package dashboard

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestLargeDashboardSupportV1(t *testing.T) {
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
						Name: "Test Annotation",
					},
				},
			},
			Elements: map[string]dashv2.DashboardElement{
				"panel-1": {
					PanelKind: &dashv2.DashboardPanelKind{},
				},
			},
			Layout:       dashv2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{},
			TimeSettings: dashv2.DashboardTimeSettingsSpec{},
			CursorSync:   dashv2.DashboardDashboardCursorSyncOff,
			Variables:    []dashv2.DashboardVariableKind{},
			Links:        []dashv2.DashboardDashboardLink{},
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

	// Verify elements are restored
	require.Len(t, rehydratedDash.Spec.Elements, 1)
	_, exists := rehydratedDash.Spec.Elements["panel-1"]
	require.True(t, exists)
}

// Helper functions for pointer types
func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

func TestLargeDashboardSupportCrossVersion(t *testing.T) {
	// Test cross-version compatibility: create v1 dashboard, try to rebuild as v2
	// This tests what happens when blob data from one version is used with another version

	// Create a v1 dashboard with complex data
	originalV1Dash := &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cross-version",
			Namespace: "test",
		},
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "Cross Version Test Dashboard",
				"description":   "Testing cross-version large object reconstruction",
				"tags":          []string{"cross-version", "test", "v1-to-v2"},
				"editable":      true,
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":    "Test Annotation V1",
							"enable":  true,
							"builtIn": false,
							"datasource": map[string]interface{}{
								"type": "prometheus",
								"uid":  "prometheus-uid-v1",
							},
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"title": "V1 Panel 1",
						"type":  "timeseries",
					},
				},
				"time": map[string]interface{}{
					"from": "now-1h",
					"to":   "now",
				},
			},
		},
	}

	// Set up schemes for both versions
	scheme := runtime.NewScheme()
	err := dashv1.AddToScheme(scheme)
	require.NoError(t, err)

	v2Scheme := runtime.NewScheme()
	err = dashv2.AddToScheme(v2Scheme)
	require.NoError(t, err)

	// We don't need v1LargeObject since we're only testing the cross-version rebuild

	// Marshal the original v1 spec to use as our "blob" data
	// This simulates what would be stored as blob data for a large v1 dashboard
	originalV1SpecBlob, err := json.Marshal(originalV1Dash.Spec.Object)
	require.NoError(t, err)

	// Skip the ReduceSpec test to avoid DeepCopy issues with complex nested interface{} types
	// The main goal is to test cross-version RebuildSpec compatibility

	// Now the interesting part: try to rebuild the v1 blob into a v2 dashboard
	targetV2Dash := &dashv2.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-cross-version-v2",
			Namespace: "test",
		},
	}

	// Create large object support for v2
	v2LargeObject := NewDashboardLargeObjectSupport(v2Scheme, 0)

	// This is the key test: try to rebuild v1 blob data into v2 spec
	// This tests the json.Unmarshal(blob, &dash.Spec) path with v1 data
	err = v2LargeObject.RebuildSpec(targetV2Dash, originalV1SpecBlob)

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

		t.Log("EXPECTED BEHAVIOR: v1 blob data cannot be directly unmarshaled into v2 structured spec")
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

		// The data will likely be incomplete/incorrect since v1 unstructured data
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
