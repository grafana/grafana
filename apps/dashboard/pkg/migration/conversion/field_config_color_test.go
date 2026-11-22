package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func newV2alpha1DashboardWithColor(t *testing.T, color string) *dashv2alpha1.Dashboard {
	t.Helper()
	return newV2alpha1DashboardWithFieldConfig(t, `{ "defaults": { "color": `+color+` }, "overrides": [] }`)
}

func panelColor(dash *dashv2alpha1.Dashboard) *dashv2alpha1.DashboardFieldColor {
	return dash.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.Color
}

func TestFieldColorOptionalPropertiesV2RoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)
	tests := map[string]string{
		"by value":  `{ "mode": "palette-categorical-next", "byValue": true }`,
		"reverse":   `{ "mode": "continuous-GrYlRd", "reverse": true, "seriesBy": "max" }`,
		"gradient":  `{ "mode": "gradient", "fixedColor": "#73BF69", "gradientColorTo": "#F2495C" }`,
		"mode only": `{ "mode": "palette-classic" }`,
	}

	for name, color := range tests {
		t.Run(name, func(t *testing.T) {
			original := newV2alpha1DashboardWithColor(t, color)

			var v2beta1 dashv2beta1.Dashboard
			require.NoError(t, scheme.Convert(original.DeepCopy(), &v2beta1, nil))

			var roundTrip dashv2alpha1.Dashboard
			require.NoError(t, scheme.Convert(&v2beta1, &roundTrip, nil))

			assert.Equal(t, panelColor(original), panelColor(&roundTrip))
		})
	}
}

func TestFieldColorOptionalPropertiesV1RoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)
	original := newV2alpha1DashboardWithColor(t,
		`{ "mode": "palette-categorical-next", "byValue": true, "reverse": false, "fixedColor": "#73BF69", "gradientColorTo": "#F2495C", "seriesBy": "last" }`)

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
	assert.Equal(t, map[string]interface{}{
		"mode":            "palette-categorical-next",
		"byValue":         true,
		"reverse":         false,
		"fixedColor":      "#73BF69",
		"gradientColorTo": "#F2495C",
		"seriesBy":        "last",
	}, defaults["color"])

	var roundTrip dashv2alpha1.Dashboard
	require.NoError(t, scheme.Convert(&v1Dash, &roundTrip, nil))
	assert.Equal(t, panelColor(original), panelColor(&roundTrip))
}
