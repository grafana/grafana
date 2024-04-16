package angularinspector

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideService(t *testing.T) {
	t.Run("uses dynamic inspector with hardcoded fallback", func(t *testing.T) {
		dynamic, err := angulardetectorsprovider.ProvideDynamic(
			setting.NewCfg(),
			angularpatternsstore.ProvideService(kvstore.NewFakeKVStore()),
		)
		require.NoError(t, err)
		inspector, err := ProvideService(dynamic)
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
