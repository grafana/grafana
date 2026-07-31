package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// Item overrides target individual marks (rows) such as node graph nodes or pie chart slices,
// rather than fields. The matcher kind is declared by the panel plugin and is therefore
// open-ended, so conversions must carry unknown kinds through untouched.

// itemOverridesJSON is the v1 representation used by the round trip test below. It deliberately
// includes a rule whose kind no core panel declares.
func itemOverridesJSON() []interface{} {
	return []interface{}{
		map[string]interface{}{
			"matcher": map[string]interface{}{
				"id":      "byItemIds",
				"kind":    "node",
				"options": []interface{}{"eu-west", "us-east"},
			},
			"properties": []interface{}{
				map[string]interface{}{
					"id":    "color",
					"value": map[string]interface{}{"mode": "fixed", "fixedColor": "red"},
				},
			},
		},
		map[string]interface{}{
			"matcher": map[string]interface{}{
				"id":      "byItemRegexp",
				"kind":    "totallyUnknownKind",
				"options": "^us-west",
			},
			"properties": []interface{}{
				map[string]interface{}{"id": "custom.thickness", "value": float64(3)},
			},
		},
	}
}

func itemOverridesV2alpha1() []dashv2alpha1.DashboardItemOverrideRule {
	return []dashv2alpha1.DashboardItemOverrideRule{
		{
			Matcher: dashv2alpha1.DashboardItemMatcherConfig{
				Id:      "byItemIds",
				Kind:    "node",
				Options: []interface{}{"eu-west", "us-east"},
			},
			Properties: []dashv2alpha1.DashboardDynamicConfigValue{
				{Id: "color", Value: map[string]interface{}{"mode": "fixed", "fixedColor": "red"}},
			},
		},
		{
			Matcher: dashv2alpha1.DashboardItemMatcherConfig{
				Id:      "byItemRegexp",
				Kind:    "totallyUnknownKind",
				Options: "^us-west",
			},
			Properties: []dashv2alpha1.DashboardDynamicConfigValue{
				{Id: "custom.thickness", Value: float64(3)},
			},
		},
	}
}

// v2alpha1WithItemOverrides builds a single-panel v2alpha1 dashboard whose viz config carries item overrides.
func v2alpha1WithItemOverrides() *dashv2alpha1.Dashboard {
	return &dashv2alpha1.Dashboard{
		Spec: dashv2alpha1.DashboardSpec{
			Title: "Test Dashboard",
			Elements: map[string]dashv2alpha1.DashboardElement{
				"panel-1": {
					PanelKind: &dashv2alpha1.DashboardPanelKind{
						Kind: "Panel",
						Spec: dashv2alpha1.DashboardPanelSpec{
							Id:    1,
							Title: "Panel with item overrides",
							Data: dashv2alpha1.DashboardQueryGroupKind{
								Kind: "QueryGroup",
								Spec: dashv2alpha1.DashboardQueryGroupSpec{
									Queries:         []dashv2alpha1.DashboardPanelQueryKind{},
									Transformations: []dashv2alpha1.DashboardTransformationKind{},
									QueryOptions:    *dashv2alpha1.NewDashboardQueryOptionsSpec(),
								},
							},
							VizConfig: dashv2alpha1.DashboardVizConfigKind{
								Kind: "nodeGraph",
								Spec: dashv2alpha1.DashboardVizConfigSpec{
									PluginVersion: "1.0",
									Options:       map[string]interface{}{},
									FieldConfig: dashv2alpha1.DashboardFieldConfigSource{
										Defaults:      *dashv2alpha1.NewDashboardFieldConfig(),
										Overrides:     []dashv2alpha1.DashboardV2alpha1FieldConfigSourceOverrides{},
										ItemOverrides: itemOverridesV2alpha1(),
									},
								},
							},
						},
					},
				},
			},
			Layout: dashv2alpha1.DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind{
				GridLayoutKind: &dashv2alpha1.DashboardGridLayoutKind{
					Kind: "GridLayout",
					Spec: dashv2alpha1.DashboardGridLayoutSpec{
						Items: []dashv2alpha1.DashboardGridLayoutItemKind{
							{
								Kind: "GridLayoutItem",
								Spec: dashv2alpha1.DashboardGridLayoutItemSpec{
									X: 0, Y: 0, Width: 12, Height: 8,
									Element: dashv2alpha1.DashboardElementReference{
										Kind: "ElementReference",
										Name: "panel-1",
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// v1PanelFieldConfig pulls the single panel's field config out of a converted v1 dashboard.
func v1PanelFieldConfig(t *testing.T, v1 *dashv1.Dashboard) map[string]interface{} {
	t.Helper()

	panels, ok := v1.Spec.Object["panels"].([]interface{})
	require.True(t, ok, "panels should exist")
	require.Len(t, panels, 1)

	panel, ok := panels[0].(map[string]interface{})
	require.True(t, ok)
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	require.True(t, ok, "fieldConfig should exist")
	return fieldConfig
}

func TestV2alpha1ToV1ItemOverrides(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	out := &dashv1.Dashboard{}
	require.NoError(t, scheme.Convert(v2alpha1WithItemOverrides(), out, nil))

	fieldConfig := v1PanelFieldConfig(t, out)
	itemOverrides, ok := normalizeToJSONShape(fieldConfig["itemOverrides"]).([]interface{})
	require.True(t, ok, "itemOverrides should exist, got %T", fieldConfig["itemOverrides"])
	require.Len(t, itemOverrides, 2)

	assert.Equal(t, itemOverridesJSON(), itemOverrides)
}

func TestV2alpha1ToV1ItemOverridesOmittedWhenEmpty(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	in := v2alpha1WithItemOverrides()
	fc := &in.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig
	fc.ItemOverrides = nil
	// Give the field config something else to emit, so this asserts that itemOverrides is
	// dropped rather than that the whole fieldConfig collapsed to nothing.
	unit := "bytes"
	fc.Defaults.Unit = &unit

	out := &dashv1.Dashboard{}
	require.NoError(t, scheme.Convert(in, out, nil))

	fieldConfig := v1PanelFieldConfig(t, out)
	assert.Contains(t, fieldConfig, "defaults")
	assert.NotContains(t, fieldConfig, "itemOverrides")
}

func TestV2alpha1ToV2beta1ItemOverrides(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	out := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2alpha1WithItemOverrides(), out, nil))

	require.Contains(t, out.Spec.Elements, "panel-1")
	fc := out.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig
	require.Len(t, fc.ItemOverrides, 2)

	assert.Equal(t, "byItemIds", fc.ItemOverrides[0].Matcher.Id)
	assert.Equal(t, "node", fc.ItemOverrides[0].Matcher.Kind)
	assert.Equal(t, []interface{}{"eu-west", "us-east"}, fc.ItemOverrides[0].Matcher.Options)
	require.Len(t, fc.ItemOverrides[0].Properties, 1)
	assert.Equal(t, "color", fc.ItemOverrides[0].Properties[0].Id)

	assert.Equal(t, "totallyUnknownKind", fc.ItemOverrides[1].Matcher.Kind)
	assert.Equal(t, "^us-west", fc.ItemOverrides[1].Matcher.Options)
	require.Len(t, fc.ItemOverrides[1].Properties, 1)
	assert.Equal(t, "custom.thickness", fc.ItemOverrides[1].Properties[0].Id)
	assert.Equal(t, float64(3), fc.ItemOverrides[1].Properties[0].Value)
}

func TestV2beta1ToV2alpha1ItemOverrides(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	// Build the v2beta1 input by converting forwards, then convert back.
	v2beta1 := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2alpha1WithItemOverrides(), v2beta1, nil))

	out := &dashv2alpha1.Dashboard{}
	require.NoError(t, scheme.Convert(v2beta1, out, nil))

	require.Contains(t, out.Spec.Elements, "panel-1")
	fc := out.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig
	assert.Equal(t, itemOverridesV2alpha1(), fc.ItemOverrides)
}

func TestV2beta1ToV2ItemOverrides(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	v2beta1 := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2alpha1WithItemOverrides(), v2beta1, nil))

	// v2beta1 <-> v2 round trips the whole spec through JSON, so item overrides ride along
	// without a hand-written mapping; assert that here so a future hand-mapping cannot drop them.
	v2Dash := &dashv2.Dashboard{}
	require.NoError(t, scheme.Convert(v2beta1, v2Dash, nil))

	fc := v2Dash.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig
	require.Len(t, fc.ItemOverrides, 2)
	assert.Equal(t, "node", fc.ItemOverrides[0].Matcher.Kind)
	assert.Equal(t, "totallyUnknownKind", fc.ItemOverrides[1].Matcher.Kind)

	back := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2Dash, back, nil))
	assert.Equal(t, v2beta1.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig.ItemOverrides,
		back.Spec.Elements["panel-1"].PanelKind.Spec.VizConfig.Spec.FieldConfig.ItemOverrides)
}

// TestItemOverridesFullRoundTrip walks v1 -> v2alpha1 -> v2beta1 -> v2 -> v1 and asserts the
// item overrides come back unchanged, including the rule whose kind no core panel declares.
func TestItemOverridesFullRoundTrip(t *testing.T) {
	scheme := setupTestConversionScheme(t)

	v1 := &dashv1.Dashboard{
		Spec: dashv1.DashboardSpec{
			Object: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": schemaversion.LATEST_VERSION,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"type":    "nodeGraph",
						"title":   "Panel with item overrides",
						"gridPos": map[string]interface{}{"h": 8, "w": 12, "x": 0, "y": 0},
						"targets": []interface{}{},
						"fieldConfig": map[string]interface{}{
							"defaults":      map[string]interface{}{},
							"overrides":     []interface{}{},
							"itemOverrides": itemOverridesJSON(),
						},
					},
				},
			},
		},
	}

	v2alpha1 := &dashv2alpha1.Dashboard{}
	require.NoError(t, scheme.Convert(v1, v2alpha1, nil))

	v2beta1 := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2alpha1, v2beta1, nil))

	v2Dash := &dashv2.Dashboard{}
	require.NoError(t, scheme.Convert(v2beta1, v2Dash, nil))

	backToV2beta1 := &dashv2beta1.Dashboard{}
	require.NoError(t, scheme.Convert(v2Dash, backToV2beta1, nil))

	backToV2alpha1 := &dashv2alpha1.Dashboard{}
	require.NoError(t, scheme.Convert(backToV2beta1, backToV2alpha1, nil))

	backToV1 := &dashv1.Dashboard{}
	require.NoError(t, scheme.Convert(backToV2alpha1, backToV1, nil))

	// Normalise the concrete slice/map types the v1 writer emits back to the plain
	// interface{} shapes a JSON decode would produce, then compare against the input.
	fieldConfig := v1PanelFieldConfig(t, backToV1)
	assert.Equal(t, itemOverridesJSON(), normalizeToJSONShape(fieldConfig["itemOverrides"]))
}

// normalizeToJSONShape converts []map[string]interface{} values (which the v1 writer produces)
// into []interface{}, recursively, so they can be compared with JSON-decoded input.
func normalizeToJSONShape(v interface{}) interface{} {
	switch val := v.(type) {
	case []map[string]interface{}:
		out := make([]interface{}, 0, len(val))
		for _, item := range val {
			out = append(out, normalizeToJSONShape(item))
		}
		return out
	case []interface{}:
		out := make([]interface{}, 0, len(val))
		for _, item := range val {
			out = append(out, normalizeToJSONShape(item))
		}
		return out
	case map[string]interface{}:
		out := make(map[string]interface{}, len(val))
		for k, item := range val {
			out[k] = normalizeToJSONShape(item)
		}
		return out
	default:
		return v
	}
}
