package dashboard

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
)

func TestLargeDashboardSupport(t *testing.T) {
	devdash := "../../../../devenv/dev-dashboards/all-panels.json"

	// nolint:gosec
	// We can ignore the gosec G304 warning because this is a test with hardcoded input values
	f, err := os.ReadFile(devdash)
	require.NoError(t, err)

	dash := &dashboard.Dashboard{
		ObjectMeta: v1.ObjectMeta{
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

	largeObject := newDashboardLargeObjectSupport()

	// Convert the dashboard to a small value
	err = largeObject.ReduceSpec(dash)
	require.NoError(t, err)

	small, err := json.MarshalIndent(&dash.Spec, "", "  ")
	require.NoError(t, err)
	require.JSONEq(t, `{
		"schemaVersion": 33,
		"title": "Panel tests - All panels"
	}`, string(small))

	// Now make it big again
	err = largeObject.RebuildSpec(dash, f)
	require.NoError(t, err)

	// check that all panels exist again
	panels, found, err = unstructured.NestedSlice(dash.Spec.Object, "panels")
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, panels, expectedPanelCount)
}
