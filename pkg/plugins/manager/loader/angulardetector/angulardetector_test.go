package angulardetector

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestProvideInspector(t *testing.T) {
	t.Run("uses hardcoded inspector if feature flag is not present", func(t *testing.T) {
		inspector, err := ProvideInspector(&config.Cfg{
			Features: featuremgmt.WithFeatures(),
		})
		require.NoError(t, err)
		require.IsType(t, inspector, &PatternsListInspector{})
		patternsListInspector := inspector.(*PatternsListInspector)
		detectors := patternsListInspector.detectorsProvider.provideDetectors(context.Background())
		require.NotEmpty(t, detectors, "provided detectors should not be empty")
		require.Equal(t, defaultDetectors, detectors, "provided detectors should be the hardcoded ones")
	})

	t.Run("uses remote inspector with hardcoded fallback if feature flag is present", func(t *testing.T) {
		inspector, err := ProvideInspector(&config.Cfg{
			Features: featuremgmt.WithFeatures(featuremgmt.FlagPluginsRemoteAngularDetectionPatterns),
		})
		require.NoError(t, err)
		require.IsType(t, inspector, &PatternsListInspector{})
		require.IsType(t, inspector.(*PatternsListInspector).detectorsProvider, sequenceDetectorsProvider{})
		seq := inspector.(*PatternsListInspector).detectorsProvider.(sequenceDetectorsProvider)
		require.Len(t, seq, 2, "should return the correct number of providers")
		require.IsType(t, seq[0], &gcomDetectorsProvider{}, "first detector provided should be gcom")
		require.IsType(t, seq[1], &staticDetectorsProvider{}, "second detector provided should be static")
		staticDetectors := seq[1].provideDetectors(context.Background())
		require.NotEmpty(t, staticDetectors, "provided static detectors should not be empty")
		require.Equal(t, defaultDetectors, staticDetectors, "should provide hardcoded detectors as fallback")
	})
}
