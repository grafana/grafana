package query

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestMergeForwardedFeatureTogglesHeader(t *testing.T) {
	ctx := context.Background()
	ft := featuremgmt.WithFeatures(featuremgmt.FlagDsAbstractionApp, featuremgmt.FlagSqlExpressions)

	out := mergeForwardedFeatureTogglesHeader(map[string]string{"Cookie": "x=y"}, ft, ctx)

	require.Equal(t, "x=y", out["Cookie"])
	require.Contains(t, out["X-Grafana-Forwarded-Feature-Toggles"], "dsAbstractionApp")
	require.Contains(t, out["X-Grafana-Forwarded-Feature-Toggles"], "sqlExpressions")
}

func TestMergeForwardedFeatureTogglesHeader_nilToggles(t *testing.T) {
	in := map[string]string{"k": "v"}
	out := mergeForwardedFeatureTogglesHeader(in, nil, context.Background())
	require.Equal(t, in, out)
}
