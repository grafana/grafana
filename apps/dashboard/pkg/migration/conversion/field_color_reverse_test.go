package conversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func TestFieldColorReverse(t *testing.T) {
	t.Run("v1 to v2alpha1 keeps reverse", func(t *testing.T) {
		for _, reverse := range []bool{true, false} {
			color := buildFieldColor(map[string]interface{}{"mode": "continuous-GrYlRd", "reverse": reverse})
			require.NotNil(t, color.Reverse)
			assert.Equal(t, reverse, *color.Reverse)
		}
	})

	t.Run("v1 to v2alpha1 leaves reverse unset when missing", func(t *testing.T) {
		color := buildFieldColor(map[string]interface{}{"mode": "continuous-GrYlRd"})
		assert.Nil(t, color.Reverse)
	})

	t.Run("v2alpha1 to v1 keeps reverse", func(t *testing.T) {
		reverse := true
		colorMap := convertFieldColorToV1(&dashv2alpha1.DashboardFieldColor{Mode: "continuous-GrYlRd", Reverse: &reverse})
		assert.Equal(t, map[string]interface{}{"mode": "continuous-GrYlRd", "reverse": true}, colorMap)

		colorMap = convertFieldColorToV1(&dashv2alpha1.DashboardFieldColor{Mode: "continuous-GrYlRd"})
		assert.NotContains(t, colorMap, "reverse")
	})

	t.Run("v2alpha1 and v2beta1 keep reverse", func(t *testing.T) {
		reverse := true
		alpha := &dashv2alpha1.DashboardFieldConfig{Color: &dashv2alpha1.DashboardFieldColor{Mode: "continuous-GrYlRd", Reverse: &reverse}}

		beta := &dashv2beta1.DashboardFieldConfig{}
		convertFieldConfig_V2alpha1_to_V2beta1(alpha, beta)
		require.NotNil(t, beta.Color.Reverse)
		assert.True(t, *beta.Color.Reverse)

		back := &dashv2alpha1.DashboardFieldConfig{}
		convertFieldConfig_V2beta1_to_V2alpha1(beta, back)
		require.NotNil(t, back.Color.Reverse)
		assert.True(t, *back.Color.Reverse)
	})
}
