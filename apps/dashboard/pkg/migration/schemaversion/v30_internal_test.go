package schemaversion

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetActiveThresholdColor_NegativeThreshold(t *testing.T) {
	thresholds := map[string]interface{}{
		"mode": "absolute",
		"steps": []interface{}{
			map[string]interface{}{
				"color": "green",
				"value": nil, // base threshold (-Infinity)
			},
			map[string]interface{}{
				"color": "yellow",
				"value": float64(-1), // step at -1.0
			},
			map[string]interface{}{
				"color": "red",
				"value": float64(0), // step at 0.0
			},
		},
	}

	t.Run("value equal to -1 should match step -1", func(t *testing.T) {
		color := getActiveThresholdColor(-1.0, thresholds)
		require.Equal(t, "yellow", color)
	})

	t.Run("value greater than -1 but less than 0 should match step -1", func(t *testing.T) {
		color := getActiveThresholdColor(-0.5, thresholds)
		require.Equal(t, "yellow", color)
	})

	t.Run("value less than -1 should match base green", func(t *testing.T) {
		color := getActiveThresholdColor(-2.0, thresholds)
		require.Equal(t, "green", color)
	})
}
