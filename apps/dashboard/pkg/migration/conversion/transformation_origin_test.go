package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// A transformation's origin records whether the visualization or the transformations editor
// created it. Every conversion builds TransformationSpec field by field, so each hop has to carry
// the field explicitly or it is silently dropped.

func strPtr(s string) *string { return &s }

func TestTransformationOrigin_V2beta1_to_V2(t *testing.T) {
	t.Run("carries source and pluginId", func(t *testing.T) {
		out := convertTransformationOriginToV2(&dashv2beta1.DashboardTransformationOrigin{
			Source:   "panel",
			PluginId: strPtr("table"),
		})

		require.NotNil(t, out)
		assert.Equal(t, dashv2.DashboardTransformationOriginSource("panel"), out.Source)
		assert.Equal(t, "table", *out.PluginId)
	})

	t.Run("keeps nil nil", func(t *testing.T) {
		assert.Nil(t, convertTransformationOriginToV2(nil))
	})

	t.Run("omits an absent pluginId", func(t *testing.T) {
		out := convertTransformationOriginToV2(&dashv2beta1.DashboardTransformationOrigin{Source: "editor"})

		require.NotNil(t, out)
		assert.Nil(t, out.PluginId)
	})
}

func TestTransformationOrigin_V2_to_V2beta1(t *testing.T) {
	t.Run("carries source and pluginId", func(t *testing.T) {
		out := convertTransformationOriginToV2beta1(&dashv2.DashboardTransformationOrigin{
			Source:   "panel",
			PluginId: strPtr("table"),
		})

		require.NotNil(t, out)
		assert.Equal(t, dashv2beta1.DashboardTransformationOriginSource("panel"), out.Source)
		assert.Equal(t, "table", *out.PluginId)
	})

	t.Run("keeps nil nil", func(t *testing.T) {
		assert.Nil(t, convertTransformationOriginToV2beta1(nil))
	})
}

func TestTransformationOrigin_V2alpha1_V2beta1_RoundTrip(t *testing.T) {
	in := &dashv2alpha1.DashboardTransformationKind{
		Kind: "organize",
		Spec: dashv2alpha1.DashboardDataTransformerConfig{
			Id:      "organize",
			Options: map[string]interface{}{},
			Origin: &dashv2alpha1.DashboardTransformationOrigin{
				Source:   "panel",
				PluginId: strPtr("table"),
			},
		},
	}

	beta := &dashv2beta1.DashboardTransformationKind{}
	convertTransformation_V2alpha1_to_V2beta1(in, beta)

	require.NotNil(t, beta.Spec.Origin)
	assert.Equal(t, dashv2beta1.DashboardTransformationOriginSource("panel"), beta.Spec.Origin.Source)
	assert.Equal(t, "table", *beta.Spec.Origin.PluginId)

	back := &dashv2alpha1.DashboardTransformationKind{}
	convertTransformation_V2beta1_to_V2alpha1(beta, back)

	require.NotNil(t, back.Spec.Origin)
	assert.Equal(t, in.Spec.Origin.Source, back.Spec.Origin.Source)
	assert.Equal(t, *in.Spec.Origin.PluginId, *back.Spec.Origin.PluginId)
}

func TestTransformationOrigin_V2alpha1_V2beta1_NilStaysNil(t *testing.T) {
	in := &dashv2alpha1.DashboardTransformationKind{
		Kind: "organize",
		Spec: dashv2alpha1.DashboardDataTransformerConfig{Id: "organize", Options: map[string]interface{}{}},
	}

	beta := &dashv2beta1.DashboardTransformationKind{}
	convertTransformation_V2alpha1_to_V2beta1(in, beta)
	assert.Nil(t, beta.Spec.Origin)

	back := &dashv2alpha1.DashboardTransformationKind{}
	convertTransformation_V2beta1_to_V2alpha1(beta, back)
	assert.Nil(t, back.Spec.Origin)
}

func TestBuildTransformationOrigin(t *testing.T) {
	t.Run("reads a panel origin from v1 JSON", func(t *testing.T) {
		out := buildTransformationOrigin(map[string]interface{}{"source": "panel", "pluginId": "table"})

		require.NotNil(t, out)
		assert.Equal(t, dashv2alpha1.DashboardTransformationOriginSource("panel"), out.Source)
		assert.Equal(t, "table", *out.PluginId)
	})

	t.Run("reads an editor origin without a pluginId", func(t *testing.T) {
		out := buildTransformationOrigin(map[string]interface{}{"source": "editor"})

		require.NotNil(t, out)
		assert.Equal(t, dashv2alpha1.DashboardTransformationOriginSource("editor"), out.Source)
		assert.Nil(t, out.PluginId)
	})

	// The schema only allows two values; anything else would persist an invalid enum.
	t.Run("drops an unknown source", func(t *testing.T) {
		assert.Nil(t, buildTransformationOrigin(map[string]interface{}{"source": "somethingelse"}))
		assert.Nil(t, buildTransformationOrigin(map[string]interface{}{}))
	})
}

func TestTransformPanelTransformations_Origin(t *testing.T) {
	t.Run("carries origin from v1 into v2alpha1", func(t *testing.T) {
		panelMap := map[string]interface{}{
			"transformations": []interface{}{
				map[string]interface{}{
					"id":      "organize",
					"options": map[string]interface{}{},
					"origin":  map[string]interface{}{"source": "panel", "pluginId": "table"},
				},
			},
		}

		out := transformPanelTransformations(panelMap)

		require.Len(t, out, 1)
		require.NotNil(t, out[0].Spec.Origin)
		assert.Equal(t, dashv2alpha1.DashboardTransformationOriginSource("panel"), out[0].Spec.Origin.Source)
		assert.Equal(t, "table", *out[0].Spec.Origin.PluginId)
	})

	// Transformations saved before the field existed have no origin, which means "editor".
	t.Run("leaves origin unset when v1 has none", func(t *testing.T) {
		panelMap := map[string]interface{}{
			"transformations": []interface{}{
				map[string]interface{}{"id": "organize", "options": map[string]interface{}{}},
			},
		}

		out := transformPanelTransformations(panelMap)

		require.Len(t, out, 1)
		assert.Nil(t, out[0].Spec.Origin)
	})
}
