package conversion

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

const fieldConfigWithVarMappings = `{
  "defaults": {
    "min": 0,
    "varMappings": { "min": "$min", "custom.lineWidth": "${width}" }
  },
  "overrides": [
    {
      "matcher": { "id": "byName", "options": "A" },
      "properties": [
        { "id": "min", "value": 5 },
        { "id": "varMappings.min", "value": "$overrideMin" }
      ]
    }
  ]
}`

func newV2alpha1DashboardWithFieldConfig(t *testing.T, fieldConfig string) *dashv2alpha1.Dashboard {
	t.Helper()
	spec := `{
    "title": "varMappings",
    "elements": {
      "panel-1": {
        "kind": "Panel",
        "spec": {
          "id": 1,
          "title": "Panel",
          "description": "",
          "links": [],
          "data": { "kind": "QueryGroup", "spec": { "queries": [], "transformations": [], "queryOptions": {} } },
          "vizConfig": {
            "kind": "timeseries",
            "spec": { "pluginVersion": "", "options": {}, "fieldConfig": ` + fieldConfig + ` }
          }
        }
      }
    },
    "layout": {
      "kind": "GridLayout",
      "spec": {
        "items": [
          {
            "kind": "GridLayoutItem",
            "spec": { "x": 0, "y": 0, "width": 12, "height": 8, "element": { "kind": "ElementReference", "name": "panel-1" } }
          }
        ]
      }
    }
  }`
	dash := &dashv2alpha1.Dashboard{}
	require.NoError(t, json.Unmarshal([]byte(spec), &dash.Spec))
	return dash
}

func TestFieldConfigVarMappingsV2RoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)
	original := newV2alpha1DashboardWithFieldConfig(t, fieldConfigWithVarMappings)
	expectedVarMappings := map[string]string{"min": "$min", "custom.lineWidth": "${width}"}

	var v2beta1 dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(original.DeepCopy(), &v2beta1, nil))
	v2beta1FieldConfig := v2beta1.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig
	assert.Equal(t, expectedVarMappings, v2beta1FieldConfig.Defaults.VarMappings)

	var roundTrip dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(&v2beta1, &roundTrip, nil))

	expectedJSON, err := json.Marshal(original.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig)
	require.NoError(t, err)
	actualJSON, err := json.Marshal(roundTrip.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig)
	require.NoError(t, err)
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestFieldConfigVarMappingsV2LeavesAbsentVarMappingsUnset(t *testing.T) {
	scheme := setupTestConversionScheme(t)
	original := newV2alpha1DashboardWithFieldConfig(t, `{ "defaults": { "min": 1 }, "overrides": [] }`)

	var v2beta1 dashv2beta1.Dashboard
	require.NoError(t, scheme.Convert(original, &v2beta1, nil))
	assert.Nil(t, v2beta1.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.VarMappings)
}

func TestFieldConfigVarMappingsV1RoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)
	original := newV2alpha1DashboardWithFieldConfig(t, fieldConfigWithVarMappings)

	var v1Dash dashv1.Dashboard
	require.NoError(t, scheme.Convert(original.DeepCopy(), &v1Dash, nil))
	panels, ok := v1Dash.Spec.Object["panels"].([]interface{})
	require.True(t, ok)
	require.Len(t, panels, 1)
	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok)
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	require.True(t, ok)
	defaults, ok := fieldConfig["defaults"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, map[string]interface{}{"min": "$min", "custom.lineWidth": "${width}"}, defaults["varMappings"])

	var roundTrip dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(&v1Dash, &roundTrip, nil))
	assert.Equal(t,
		map[string]string{"min": "$min", "custom.lineWidth": "${width}"},
		roundTrip.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.VarMappings,
	)
}
