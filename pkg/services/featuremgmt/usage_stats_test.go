package featuremgmt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFeatureUsageStats(t *testing.T) {
	featureManagerWithAllFeatures := WithManager(
		"database_metrics",
		"live-config",
		"UPPER_SNAKE_CASE",
		"feature.with.a.dot",
	)

	require.Equal(t, map[string]any{
		"stats.features.database_metrics.count":   1,
		"stats.features.live_config.count":        1,
		"stats.features.upper_snake_case.count":   1,
		"stats.features.feature_with_a_dot.count": 1,
	}, featureManagerWithAllFeatures.GetUsageStats(context.Background()))
}
