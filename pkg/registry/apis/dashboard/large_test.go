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
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
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

func TestLargeDashboardSupportV2alpha1(t *testing.T) {
	// Test RebuildSpec functionality specifically for v2 dashboards
	// This tests the json.Unmarshal(blob, &dash.Spec) path for structured specs
	// unlike v0/v1 which use the UnmarshalJSON path for unstructured specs

	// Create a v2 dashboard with structured spec
	originalV2Dash := &dashv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-v2",
			Namespace: "test",
		},
		Spec: dashv2alpha1.DashboardSpec{
			Title:       "Test V2 Dashboard",
			Description: stringPtr("A test dashboard for v2 large object support"),
			Tags:        []string{"test", "v2", "large-object"},
			Editable:    boolPtr(true),
			LiveNow:     boolPtr(false),
			Preload:     false,
			Annotations: []dashv2alpha1.DashboardAnnotationQueryKind{
				{
					Kind: "AnnotationQuery",
					Spec: dashv2alpha1.DashboardAnnotationQuerySpec{
						Name: "Test Annotation",
					},
				},
			},
			Elements: map[string]dashv2alpha1.DashboardElement{
				"panel-1": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{},
				},
			},
			Layout:       dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{},
			TimeSettings: dashv2alpha1.DashboardTimeSettingsSpec{},
			CursorSync:   dashv2alpha1.DashboardDashboardCursorSyncOff,
			Variables:    []dashv2alpha1.DashboardVariableKind{},
			Links:        []dashv2alpha1.DashboardDashboardLink{},
		},
	}

	scheme := runtime.NewScheme()
	err := dashv2alpha1.AddToScheme(scheme)
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
	rehydratedDash := &dashv2alpha1.Dashboard{
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

func TestLargeDashboardSupportV2alpha2(t *testing.T) {
	// Test RebuildSpec functionality specifically for v2 dashboards
	// This tests the json.Unmarshal(blob, &dash.Spec) path for structured specs
	// unlike v0/v1 which use the UnmarshalJSON path for unstructured specs

	// Create a v2 dashboard with structured spec
	originalV2Dash := &dashv2alpha2.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-v2",
			Namespace: "test",
		},
		Spec: dashv2alpha2.DashboardSpec{
			Title:       "Test V2 Dashboard",
			Description: stringPtr("A test dashboard for v2 large object support"),
			Tags:        []string{"test", "v2", "large-object"},
			Editable:    boolPtr(true),
			LiveNow:     boolPtr(false),
			Preload:     false,
			Annotations: []dashv2alpha2.DashboardAnnotationQueryKind{
				{
					Kind: "AnnotationQuery",
					Spec: dashv2alpha2.DashboardAnnotationQuerySpec{
						Name: "Test Annotation",
					},
				},
			},
			Elements: map[string]dashv2alpha2.DashboardElement{
				"panel-1": {
					PanelKind: &dashv2alpha2.DashboardPanelKind{},
				},
			},
			Layout:       dashv2alpha2.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{},
			TimeSettings: dashv2alpha2.DashboardTimeSettingsSpec{},
			CursorSync:   dashv2alpha2.DashboardDashboardCursorSyncOff,
			Variables:    []dashv2alpha2.DashboardVariableKind{},
			Links:        []dashv2alpha2.DashboardDashboardLink{},
		},
	}

	scheme := runtime.NewScheme()
	err := dashv2alpha2.AddToScheme(scheme)
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
	rehydratedDash := &dashv2alpha2.Dashboard{
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
