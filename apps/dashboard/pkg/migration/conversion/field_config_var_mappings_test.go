package conversion

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func newV1DashboardWithFieldConfig(fieldConfig map[string]interface{}) *dashv1.Dashboard {
	return &dashv1.Dashboard{
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "varMappings",
				"schemaVersion": schemaversion.LATEST_VERSION,
				"panels": []interface{}{
					map[string]interface{}{
						"id":          1,
						"type":        "timeseries",
						"title":       "Panel",
						"gridPos":     map[string]interface{}{"x": 0, "y": 0, "w": 12, "h": 8},
						"fieldConfig": fieldConfig,
					},
				},
			},
		},
	}
}

func v1PanelFieldConfig(t *testing.T, dash *dashv1.Dashboard) map[string]interface{} {
	t.Helper()
	panels, ok := dash.Spec.Object["panels"].([]interface{})
	require.True(t, ok)
	require.Len(t, panels, 1)
	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok)
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	require.True(t, ok)
	return fieldConfig
}

func v2alpha1PanelFieldConfig(t *testing.T, dash *dashv2alpha1.Dashboard) dashv2alpha1.DashboardFieldConfigSource {
	t.Helper()
	panel, ok := dash.Spec.Elements["panel-1"]
	require.True(t, ok)
	require.NotNil(t, panel.PanelKind)
	return panel.PanelKind.Spec.VizConfig.Spec.FieldConfig
}

func v2beta1PanelFieldConfig(t *testing.T, dash *dashv2beta1.Dashboard) dashv2beta1.DashboardFieldConfigSource {
	t.Helper()
	panel, ok := dash.Spec.Elements["panel-1"]
	require.True(t, ok)
	require.NotNil(t, panel.PanelKind)
	return panel.PanelKind.Spec.VizConfig.Spec.FieldConfig
}

func TestFieldConfigVarMappingsRoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	original := newV1DashboardWithFieldConfig(map[string]interface{}{
		"defaults": map[string]interface{}{
			"min": float64(0),
			"varMappings": map[string]interface{}{
				"min":              "$min",
				"custom.lineWidth": "${width}",
			},
		},
		"overrides": []interface{}{
			map[string]interface{}{
				"matcher": map[string]interface{}{"id": "byName", "options": "A"},
				"properties": []interface{}{
					map[string]interface{}{"id": "min", "value": float64(5)},
					map[string]interface{}{"id": "varMappings.min", "value": "$overrideMin"},
				},
			},
		},
	})
	originalFieldConfig := v1PanelFieldConfig(t, original.DeepCopy())

	var v2alpha1 dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(original, &v2alpha1, nil))
	expectedVarMappings := map[string]string{"min": "$min", "custom.lineWidth": "${width}"}
	assert.Equal(t, expectedVarMappings, v2alpha1PanelFieldConfig(t, &v2alpha1).Defaults.VarMappings)

	var v2beta1 dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(&v2alpha1, &v2beta1, nil))
	assert.Equal(t, expectedVarMappings, v2beta1PanelFieldConfig(t, &v2beta1).Defaults.VarMappings)

	var v2alpha1RoundTrip dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(&v2beta1, &v2alpha1RoundTrip, nil))
	assert.Equal(t, expectedVarMappings, v2alpha1PanelFieldConfig(t, &v2alpha1RoundTrip).Defaults.VarMappings)

	var v1RoundTrip dashv1.Dashboard
	require.NoError(t, scheme.Convert(&v2alpha1RoundTrip, &v1RoundTrip, nil))
	roundTripFieldConfig := v1PanelFieldConfig(t, &v1RoundTrip)

	expectedJSON, err := json.Marshal(originalFieldConfig)
	require.NoError(t, err)
	actualJSON, err := json.Marshal(roundTripFieldConfig)
	require.NoError(t, err)
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestFieldConfigVarMappingsV1ToV2alpha1(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	t.Run("keeps only string expressions", func(t *testing.T) {
		dash := newV1DashboardWithFieldConfig(map[string]interface{}{
			"defaults": map[string]interface{}{
				"varMappings": map[string]interface{}{
					"min": "$min",
					"max": float64(10),
				},
			},
			"overrides": []interface{}{},
		})

		var v2alpha1 dashv2alpha1.Dashboard
		require.NoError(t, scheme.Convert(dash, &v2alpha1, nil))
		assert.Equal(t, map[string]string{"min": "$min"}, v2alpha1PanelFieldConfig(t, &v2alpha1).Defaults.VarMappings)
	})

	t.Run("treats a map without string expressions as absent", func(t *testing.T) {
		for name, varMappings := range map[string]map[string]interface{}{
			"empty":       {},
			"non-strings": {"max": float64(10)},
		} {
			t.Run(name, func(t *testing.T) {
				dash := newV1DashboardWithFieldConfig(map[string]interface{}{
					"defaults":  map[string]interface{}{"varMappings": varMappings},
					"overrides": []interface{}{},
				})

				var v2alpha1 dashv2alpha1.Dashboard
				require.NoError(t, scheme.Convert(dash, &v2alpha1, nil))
				defaults := v2alpha1PanelFieldConfig(t, &v2alpha1).Defaults
				assert.Nil(t, defaults.VarMappings)
				assert.Equal(t, map[string]interface{}{}, defaults.Custom)
			})
		}
	})

	t.Run("leaves varMappings unset when absent", func(t *testing.T) {
		dash := newV1DashboardWithFieldConfig(map[string]interface{}{
			"defaults":  map[string]interface{}{"min": float64(1)},
			"overrides": []interface{}{},
		})

		var v2alpha1 dashv2alpha1.Dashboard
		require.NoError(t, scheme.Convert(dash, &v2alpha1, nil))
		assert.Nil(t, v2alpha1PanelFieldConfig(t, &v2alpha1).Defaults.VarMappings)

		var v1RoundTrip dashv1.Dashboard
		require.NoError(t, scheme.Convert(&v2alpha1, &v1RoundTrip, nil))
		defaults, ok := v1PanelFieldConfig(t, &v1RoundTrip)["defaults"].(map[string]interface{})
		require.True(t, ok)
		assert.NotContains(t, defaults, "varMappings")
	})
}
