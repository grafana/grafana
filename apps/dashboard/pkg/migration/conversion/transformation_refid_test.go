package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func v1DashboardWithTransformationRefID(refID interface{}) *dashv1.Dashboard {
	transformation := map[string]interface{}{
		"id":      "reduce",
		"options": map[string]interface{}{"reducers": []interface{}{"max"}},
	}
	if refID != nil {
		transformation["refId"] = refID
	}

	return &dashv1.Dashboard{
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"id":              1,
						"type":            "table",
						"title":           "Panel with a static transformation refId",
						"gridPos":         map[string]interface{}{"h": 8, "w": 12, "x": 0, "y": 0},
						"targets":         []interface{}{map[string]interface{}{"refId": "A"}},
						"transformations": []interface{}{transformation},
					},
				},
			},
		},
	}
}

func firstPanelTransformationRefIDV1(t *testing.T, dashboard *dashv1.Dashboard) (string, bool) {
	t.Helper()

	panels, ok := dashboard.Spec.Object["panels"].([]interface{})
	require.True(t, ok, "dashboard should have panels")
	require.Len(t, panels, 1)

	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok, "panel should be an object")

	transformations, ok := panel["transformations"].([]map[string]interface{})
	require.True(t, ok, "panel should have transformations")
	require.Len(t, transformations, 1)

	refID, ok := transformations[0]["refId"].(string)
	return refID, ok
}

// v1 reaches v2beta1 and v2 through v2alpha1, so every version in the chain has to carry the
// static refId. Dropping it anywhere silently breaks the byRefId filters it exists to keep stable.
func TestTransformationRefIDSurvivesConversion(t *testing.T) {
	scheme := newTestScheme(t)

	t.Run("v1 to v2alpha1", func(t *testing.T) {
		out := &dashv2alpha1.Dashboard{}
		require.NoError(t, scheme.Convert(v1DashboardWithTransformationRefID("T-A"), out, nil))

		transformations := out.Spec.Elements["panel-1"].PanelKind.Spec.Data.Spec.Transformations
		require.Len(t, transformations, 1)
		require.NotNil(t, transformations[0].Spec.RefId)
		assert.Equal(t, "T-A", *transformations[0].Spec.RefId)
	})

	t.Run("v1 to v2beta1 through v2alpha1", func(t *testing.T) {
		out := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(v1DashboardWithTransformationRefID("T-A"), out, nil))

		transformations := out.Spec.Elements["panel-1"].PanelKind.Spec.Data.Spec.Transformations
		require.Len(t, transformations, 1)
		require.NotNil(t, transformations[0].Spec.RefId)
		assert.Equal(t, "T-A", *transformations[0].Spec.RefId)
	})

	t.Run("v1 to v2 through v2alpha1 and v2beta1", func(t *testing.T) {
		out := &dashv2.Dashboard{}
		require.NoError(t, scheme.Convert(v1DashboardWithTransformationRefID("T-A"), out, nil))

		transformations := out.Spec.Elements["panel-1"].PanelKind.Spec.Data.Spec.Transformations
		require.Len(t, transformations, 1)
		require.NotNil(t, transformations[0].Spec.RefId)
		assert.Equal(t, "T-A", *transformations[0].Spec.RefId)
	})

	t.Run("v1 round-trip through v2", func(t *testing.T) {
		v2Dashboard := &dashv2.Dashboard{}
		require.NoError(t, scheme.Convert(v1DashboardWithTransformationRefID("T-A"), v2Dashboard, nil))

		out := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(v2Dashboard, out, nil))

		refID, ok := firstPanelTransformationRefIDV1(t, out)
		require.True(t, ok, "refId should be written back to the v1 panel JSON")
		assert.Equal(t, "T-A", refID)
	})

	t.Run("transformation without a static refId gains no refId", func(t *testing.T) {
		v2Dashboard := &dashv2.Dashboard{}
		require.NoError(t, scheme.Convert(v1DashboardWithTransformationRefID(nil), v2Dashboard, nil))

		transformations := v2Dashboard.Spec.Elements["panel-1"].PanelKind.Spec.Data.Spec.Transformations
		require.Len(t, transformations, 1)
		assert.Nil(t, transformations[0].Spec.RefId)

		out := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(v2Dashboard, out, nil))

		_, ok := firstPanelTransformationRefIDV1(t, out)
		assert.False(t, ok, "refId should stay absent so existing dashboards are untouched")
	})
}
