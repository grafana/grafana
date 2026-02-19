package store

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestAlertRuleToModelsAlertRule(t *testing.T) {
	g := ngmodels.RuleGen

	t.Run("make sure no data is lost between conversions", func(t *testing.T) {
		for _, rule := range g.GenerateMany(100) {
			r, err := alertRuleFromModelsAlertRule(rule)
			require.NoError(t, err)
			clone, err := alertRuleToModelsAlertRule(r, &logtest.Fake{})
			require.NoError(t, err)
			require.Empty(t, rule.Diff(&clone))
		}
	})

	t.Run("should use NoData if NoDataState is not known", func(t *testing.T) {
		rule, err := alertRuleFromModelsAlertRule(g.Generate())
		require.NoError(t, err)
		rule.NoDataState = util.GenerateShortUID()

		converted, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, ngmodels.NoData, converted.NoDataState)
	})

	t.Run("should use Error if ExecErrState is not known", func(t *testing.T) {
		rule, err := alertRuleFromModelsAlertRule(g.Generate())
		require.NoError(t, err)
		rule.ExecErrState = util.GenerateShortUID()

		converted, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, ngmodels.ErrorErrState, converted.ExecErrState)
	})

	t.Run("should handle NoGroup rules properly", func(t *testing.T) {
		rule, err := alertRuleFromModelsAlertRule(g.Generate())
		require.NoError(t, err)
		rule.RuleGroup = ""
		projectedRuleGroup, err := ngmodels.NewNoGroupRuleGroup(rule.UID)
		require.NoError(t, err)

		converted, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, projectedRuleGroup.String(), converted.RuleGroup)

		clone, err := alertRuleFromModelsAlertRule(converted)
		require.NoError(t, err)
		require.Equal(t, rule, clone)
		require.Empty(t, clone.RuleGroup)

		converted2, err := alertRuleToModelsAlertRule(clone, &logtest.Fake{})
		require.NoError(t, err)
		require.Equal(t, converted, converted2)
	})
}

func TestAlertRuleToModelsAlertRuleCompact(t *testing.T) {
	t.Run("should only extract datasource UIDs in compact mode", func(t *testing.T) {
		rule := alertRule{
			ID:                   1,
			OrgID:                1,
			UID:                  "test-uid",
			Title:                "Test Rule",
			Condition:            "A",
			Data:                 `[{"datasourceUid":"ds1","refId":"A","queryType":"test","model":{"expr":"up"}},{"datasourceUid":"ds2","refId":"B","queryType":"test","model":{"expr":"down"}}]`,
			IntervalSeconds:      60,
			Version:              1,
			NamespaceUID:         "ns-uid",
			RuleGroup:            "test-group",
			NoDataState:          "NoData",
			ExecErrState:         "Error",
			NotificationSettings: `[{"receiver":"test-receiver"}]`,
			Metadata:             `{"editor_settings":{"simplified_query_and_expressions_section":true}}`,
		}

		compactResult, err := convertAlertRuleToModel(rule, &logtest.Fake{}, AlertRuleConvertOptions{
			ExcludeAlertQueries:         true,
			ExcludeNotificationSettings: true,
			ExcludeMetadata:             true,
		})
		require.NoError(t, err)

		// Should have datasource UIDs.
		require.Len(t, compactResult.Data, 2)
		require.Equal(t, "ds1", compactResult.Data[0].DatasourceUID)
		require.Equal(t, "ds2", compactResult.Data[1].DatasourceUID)

		// But should not have full query data (RefID, QueryType, Model should be empty).
		require.Empty(t, compactResult.Data[0].RefID)
		require.Empty(t, compactResult.Data[0].QueryType)
		require.Nil(t, compactResult.Data[0].Model)
		require.Empty(t, compactResult.Data[1].RefID)
		require.Empty(t, compactResult.Data[1].QueryType)
		require.Nil(t, compactResult.Data[1].Model)

		// Should not have notification settings.
		require.Empty(t, compactResult.NotificationSettings)

		// Should not have metadata (should be zero value).
		require.Equal(t, ngmodels.AlertRuleMetadata{}, compactResult.Metadata)
	})

	t.Run("should parse full data in non-compact mode", func(t *testing.T) {
		rule := alertRule{
			ID:                   1,
			OrgID:                1,
			UID:                  "test-uid",
			Title:                "Test Rule",
			Condition:            "A",
			Data:                 `[{"datasourceUid":"ds1","refId":"A","queryType":"test","model":{"expr":"up"}},{"datasourceUid":"ds2","refId":"B","queryType":"test","model":{"expr":"down"}}]`,
			IntervalSeconds:      60,
			Version:              1,
			NamespaceUID:         "ns-uid",
			RuleGroup:            "test-group",
			NoDataState:          "NoData",
			ExecErrState:         "Error",
			NotificationSettings: `[{"receiver":"test-receiver"}]`,
			Metadata:             `{"editor_settings":{"simplified_query_and_expressions_section":true}}`,
		}

		fullResult, err := alertRuleToModelsAlertRule(rule, &logtest.Fake{})
		require.NoError(t, err)

		// Should have full query data.
		require.Len(t, fullResult.Data, 2)
		require.Equal(t, "ds1", fullResult.Data[0].DatasourceUID)
		require.Equal(t, "A", fullResult.Data[0].RefID)
		require.Equal(t, "test", fullResult.Data[0].QueryType)
		require.NotNil(t, fullResult.Data[0].Model)

		// Should have notification settings.
		require.Len(t, fullResult.NotificationSettings, 1)
		require.Equal(t, "test-receiver", fullResult.NotificationSettings[0].Receiver)

		// Should have metadata (metadata is parsed from JSON to struct).
		require.NotEqual(t, ngmodels.AlertRuleMetadata{}, fullResult.Metadata)
	})

	t.Run("compact mode with notification settings included for filtering", func(t *testing.T) {
		rule := alertRule{
			ID:                   1,
			OrgID:                1,
			UID:                  "test-uid",
			Title:                "Test Rule",
			Condition:            "A",
			Data:                 `[{"datasourceUid":"ds1","refId":"A","queryType":"test","model":{"expr":"up"}}]`,
			IntervalSeconds:      60,
			Version:              1,
			NamespaceUID:         "ns-uid",
			RuleGroup:            "test-group",
			NoDataState:          "NoData",
			ExecErrState:         "Error",
			NotificationSettings: `[{"receiver":"test-receiver"}]`,
			Metadata:             `{"editor_settings":{"simplified_query_and_expressions_section":true}}`,
		}

		result, err := convertAlertRuleToModel(rule, &logtest.Fake{}, AlertRuleConvertOptions{
			ExcludeAlertQueries:         true,
			ExcludeNotificationSettings: false,
			ExcludeMetadata:             true,
		})
		require.NoError(t, err)

		// Should have compact query data (only datasource UIDs).
		require.Len(t, result.Data, 1)
		require.Equal(t, "ds1", result.Data[0].DatasourceUID)
		require.Empty(t, result.Data[0].RefID)

		// Should have notification settings for filtering.
		require.Len(t, result.NotificationSettings, 1)
		require.Equal(t, "test-receiver", result.NotificationSettings[0].Receiver)

		// Should not have metadata.
		require.Equal(t, ngmodels.AlertRuleMetadata{}, result.Metadata)
	})

	t.Run("compact mode with metadata included for filtering", func(t *testing.T) {
		rule := alertRule{
			ID:                   1,
			OrgID:                1,
			UID:                  "test-uid",
			Title:                "Test Rule",
			Condition:            "A",
			Data:                 `[{"datasourceUid":"ds1","refId":"A","queryType":"test","model":{"expr":"up"}}]`,
			IntervalSeconds:      60,
			Version:              1,
			NamespaceUID:         "ns-uid",
			RuleGroup:            "test-group",
			NoDataState:          "NoData",
			ExecErrState:         "Error",
			NotificationSettings: `[{"receiver":"test-receiver"}]`,
			Metadata:             `{"prometheus_style_rule":{"original_rule_definition":"alert: TestAlert\n  expr: rate(metric[5m]) > 1"}}`,
		}

		result, err := convertAlertRuleToModel(rule, &logtest.Fake{}, AlertRuleConvertOptions{
			ExcludeAlertQueries:         true,
			ExcludeNotificationSettings: true,
			ExcludeMetadata:             false,
		})
		require.NoError(t, err)

		// Should have compact query data (only datasource UIDs).
		require.Len(t, result.Data, 1)
		require.Equal(t, "ds1", result.Data[0].DatasourceUID)
		require.Empty(t, result.Data[0].RefID)

		// Should not have notification settings.
		require.Empty(t, result.NotificationSettings)

		// Should have metadata for filtering.
		require.NotEqual(t, ngmodels.AlertRuleMetadata{}, result.Metadata)
		require.True(t, result.HasPrometheusRuleDefinition())
	})
}

func TestAlertRuleVersionToAlertRule(t *testing.T) {
	g := ngmodels.RuleGen

	t.Run("make sure no data is lost between conversions", func(t *testing.T) {
		for _, rule := range g.GenerateMany(100) {
			// ignore fields
			rule.DashboardUID = nil
			rule.PanelID = nil

			r, err := alertRuleFromModelsAlertRule(rule)
			require.NoError(t, err)
			r2 := alertRuleVersionToAlertRule(alertRuleToAlertRuleVersion(r))
			require.Equal(t, r, r2)
		}
	})
}
