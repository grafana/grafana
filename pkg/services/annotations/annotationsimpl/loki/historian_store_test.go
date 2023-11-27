package loki

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestBuildLokiConfig(t *testing.T) {
	t.Run("false if state history disabled", func(t *testing.T) {
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: false,
		}
		use := useStore(cfg, featuremgmt.WithFeatures())
		require.False(t, use)
	})

	t.Run("false if any invalid backend", func(t *testing.T) {
		t.Run("single", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled: true,
				Backend: "invalid-backend",
			}
			use := useStore(cfg, featuremgmt.WithFeatures())
			require.False(t, use)
		})

		t.Run("primary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:      true,
				Backend:      "multiple",
				MultiPrimary: "invalid-backend",
			}
			use := useStore(cfg, featuremgmt.WithFeatures())
			require.False(t, use)
		})

		t.Run("secondary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:          true,
				Backend:          "multiple",
				MultiPrimary:     "annotations",
				MultiSecondaries: []string{"annotations", "invalid-backend"},
			}
			use := useStore(cfg, featuremgmt.WithFeatures())
			require.False(t, use)
		})
	})

	t.Run("false if no backend is Loki", func(t *testing.T) {
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "annotations",
		}
		use := useStore(cfg, featuremgmt.WithFeatures())
		require.False(t, use)
	})

	t.Run("true if any backend is Loki", func(t *testing.T) {
		t.Run("single", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled: true,
				Backend: "loki",
			}
			features := featuremgmt.WithFeatures(
				featuremgmt.FlagAlertStateHistoryLokiOnly,
				featuremgmt.FlagAlertStateHistoryLokiPrimary,
				featuremgmt.FlagAlertStateHistoryLokiSecondary,
			)
			use := useStore(cfg, features)
			require.True(t, use)
		})

		t.Run("primary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:          true,
				Backend:          "multiple",
				MultiPrimary:     "loki",
				MultiSecondaries: []string{"annotations"},
			}
			features := featuremgmt.WithFeatures(
				featuremgmt.FlagAlertStateHistoryLokiPrimary,
				featuremgmt.FlagAlertStateHistoryLokiSecondary,
			)
			use := useStore(cfg, features)
			require.True(t, use)
		})

		t.Run("secondary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:          true,
				Backend:          "multiple",
				MultiPrimary:     "annotations",
				MultiSecondaries: []string{"loki"},
			}
			features := featuremgmt.WithFeatures(
				featuremgmt.FlagAlertStateHistoryLokiSecondary,
			)
			use := useStore(cfg, features)
			require.True(t, use)
		})
	})
}
