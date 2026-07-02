package promconvert

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
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

func TestConvertRuleGroup_StampsSourceIdentifier(t *testing.T) {
	ds := promDS()
	group, err := ConvertRuleGroup(testCfg(false), ds, ds, 1, "folder-uid", alertGroup(), Options{
		KeepOriginalRuleDefinition: true,
		SourceIdentifier:           "ds-uid",
	})
	require.NoError(t, err)
	require.Len(t, group.Rules, 1)

	require.NotNil(t, group.Rules[0].Metadata.PrometheusStyleRule)
	assert.Equal(t, "ds-uid", group.Rules[0].Metadata.PrometheusStyleRule.SourceIdentifier)
	assert.NotEmpty(t, group.Rules[0].Metadata.PrometheusStyleRule.OriginalRuleDefinition)
}

func TestConvertRuleGroup_NoSourceIdentifierByDefault(t *testing.T) {
	ds := promDS()
	group, err := ConvertRuleGroup(testCfg(false), ds, ds, 1, "folder-uid", alertGroup(), Options{
		KeepOriginalRuleDefinition: true,
	})
	require.NoError(t, err)
	require.Len(t, group.Rules, 1)
	require.NotNil(t, group.Rules[0].Metadata.PrometheusStyleRule)
	assert.Empty(t, group.Rules[0].Metadata.PrometheusStyleRule.SourceIdentifier)
}

func TestConvertRuleGroup_RecordingRulesGate(t *testing.T) {
	ds := promDS()
	recordingGroup := apimodels.PrometheusRuleGroup{
		Name:  "rec",
		Rules: []apimodels.PrometheusRule{{Record: "job:latency:avg", Expr: "avg(latency)"}},
	}

	t.Run("rejected when recording rules disabled", func(t *testing.T) {
		_, err := ConvertRuleGroup(testCfg(false), ds, ds, 1, "folder-uid", recordingGroup, Options{})
		assert.ErrorIs(t, err, ErrRecordingRulesNotEnabled)
	})

	t.Run("allowed when recording rules enabled", func(t *testing.T) {
		group, err := ConvertRuleGroup(testCfg(true), ds, ds, 1, "folder-uid", recordingGroup, Options{})
		require.NoError(t, err)
		require.Len(t, group.Rules, 1)
		require.NotNil(t, group.Rules[0].Record)
	})
}

func TestGroupHasRecordingRules(t *testing.T) {
	assert.False(t, GroupHasRecordingRules(alertGroup()))
	assert.True(t, GroupHasRecordingRules(apimodels.PrometheusRuleGroup{
		Rules: []apimodels.PrometheusRule{{Alert: "A", Expr: "x"}, {Record: "r", Expr: "y"}},
	}))
}
