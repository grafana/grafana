package angularinspector

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
)

func TestProvideService(t *testing.T) {
	t.Run("uses hardcoded inspector if feature flag is not present", func(t *testing.T) {
		pCfg := &config.PluginManagementCfg{Features: featuremgmt.WithFeatures()}
		dynamic, err := angulardetectorsprovider.ProvideDynamic(
			pCfg,
			angularpatternsstore.ProvideService(kvstore.NewFakeKVStore()),
			featuremgmt.WithFeatures(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns),
		)
		require.NoError(t, err)
		inspector, err := ProvideService(pCfg, dynamic)
		require.NoError(t, err)
		require.IsType(t, inspector.Inspector, &angularinspector.PatternsListInspector{})
		patternsListInspector := inspector.Inspector.(*angularinspector.PatternsListInspector)
		detectors := patternsListInspector.DetectorsProvider.ProvideDetectors(context.Background())
		require.NotEmpty(t, detectors, "provided detectors should not be empty")
	})

	t.Run("uses dynamic inspector with hardcoded fallback if feature flag is present", func(t *testing.T) {
		pCfg := &config.PluginManagementCfg{Features: featuremgmt.WithFeatures(
			featuremgmt.FlagPluginsDynamicAngularDetectionPatterns,
		)}
		dynamic, err := angulardetectorsprovider.ProvideDynamic(
			pCfg,
			angularpatternsstore.ProvideService(kvstore.NewFakeKVStore()),
			featuremgmt.WithFeatures(),
		)
		require.NoError(t, err)
		inspector, err := ProvideService(pCfg, dynamic)
		require.NoError(t, err)
		require.IsType(t, inspector.Inspector, &angularinspector.PatternsListInspector{})
		require.IsType(t, inspector.Inspector.(*angularinspector.PatternsListInspector).DetectorsProvider, angulardetector.SequenceDetectorsProvider{})
		seq := inspector.Inspector.(*angularinspector.PatternsListInspector).DetectorsProvider.(angulardetector.SequenceDetectorsProvider)
		require.Len(t, seq, 2, "should return the correct number of providers")
		require.IsType(t, seq[0], &angulardetectorsprovider.Dynamic{}, "first AngularDetector provided should be gcom")
		require.IsType(t, seq[1], &angulardetector.StaticDetectorsProvider{}, "second AngularDetector provided should be static")
		staticDetectors := seq[1].ProvideDetectors(context.Background())
		require.NotEmpty(t, staticDetectors, "provided static detectors should not be empty")
	})
}
