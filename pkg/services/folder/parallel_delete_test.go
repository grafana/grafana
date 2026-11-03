package folder

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestParallelDashboardDeleteConcurrency(t *testing.T) {
	t.Run("defaults to sequential", func(t *testing.T) {
		featuremgmt.WithFlagValues(t, map[string]any{})
		require.Equal(t, 1, ParallelDashboardDeleteConcurrency(t.Context()))
	})

	for _, tc := range []struct {
		name  string
		value any
		want  int
	}{
		{"configured value", 8, 8},
		{"zero is sequential", 0, 1},
		{"negative is sequential", -3, 1},
		{"non-integer is sequential", "lots", 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithFlagValues(t, map[string]any{featuremgmt.FlagFoldersParallelDashboardDeleteConcurrency: tc.value})
			require.Equal(t, tc.want, ParallelDashboardDeleteConcurrency(t.Context()))
		})
	}
}
