package prom

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/setting"
)

func testCfg(recordingEnabled bool) *setting.UnifiedAlertingSettings {
	return &setting.UnifiedAlertingSettings{
		DefaultRuleEvaluationInterval: time.Minute,
		RecordingRules:                setting.RecordingRuleSettings{Enabled: recordingEnabled},
	}
}

func promDS() *datasources.DataSource {
	return &datasources.DataSource{UID: "ds-uid", Type: datasources.DS_PROMETHEUS}
}

func alertGroup() apimodels.PrometheusRuleGroup {
	return apimodels.PrometheusRuleGroup{
		Name:  "g1",
		Rules: []apimodels.PrometheusRule{{Alert: "HighLatency", Expr: "latency > 1"}},
	}
}

func TestConvertRuleGroup(t *testing.T) {
	ds := promDS()
	recordingGroup := apimodels.PrometheusRuleGroup{
		Name:  "rec",
		Rules: []apimodels.PrometheusRule{{Record: "job:latency:avg", Expr: "avg(latency)"}},
	}

	t.Run("keeps the original rule definition when requested", func(t *testing.T) {
		group, err := ConvertRuleGroup(testCfg(false), ds, ds, 1, "folder-uid", alertGroup(), Options{
			KeepOriginalRuleDefinition: true,
		})
		require.NoError(t, err)
		require.Len(t, group.Rules, 1)
		require.NotNil(t, group.Rules[0].Metadata.PrometheusStyleRule)
		require.NotEmpty(t, group.Rules[0].Metadata.PrometheusStyleRule.OriginalRuleDefinition)
	})

	t.Run("rejects recording rules when the feature is disabled", func(t *testing.T) {
		_, err := ConvertRuleGroup(testCfg(false), ds, ds, 1, "folder-uid", recordingGroup, Options{})
		require.ErrorIs(t, err, ErrRecordingRulesNotEnabled)
	})

	t.Run("converts recording rules when the feature is enabled", func(t *testing.T) {
		group, err := ConvertRuleGroup(testCfg(true), ds, ds, 1, "folder-uid", recordingGroup, Options{})
		require.NoError(t, err)
		require.Len(t, group.Rules, 1)
		require.NotNil(t, group.Rules[0].Record)
	})
}

func TestGroupHasRecordingRules(t *testing.T) {
	require.False(t, GroupHasRecordingRules(alertGroup()))
	require.True(t, GroupHasRecordingRules(apimodels.PrometheusRuleGroup{
		Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "x"}, {Record: "r", Expr: "y"}},
	}))
}
