package api

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestToModel(t *testing.T) {
	t.Run("if no rules are provided the rule field should be nil", func(t *testing.T) {
		ruleGroup := definitions.AlertRuleGroup{
			Title:     "123",
			FolderUID: "123",
			Interval:  10,
		}
		tm, err := AlertRuleGroupFromApiAlertRuleGroup(ruleGroup)
		require.NoError(t, err)
		require.Nil(t, tm.Rules)
	})
	t.Run("if rules are provided the rule field should be not nil", func(t *testing.T) {
		ruleGroup := definitions.AlertRuleGroup{
			Title:     "123",
			FolderUID: "123",
			Interval:  10,
			Rules: []definitions.ProvisionedAlertRule{
				{
					UID: "1",
				},
			},
		}
		tm, err := AlertRuleGroupFromApiAlertRuleGroup(ruleGroup)
		require.NoError(t, err)
		require.Len(t, tm.Rules, 1)
	})
	t.Run("should clear recording rule ignored fields correctly", func(t *testing.T) {
		ruleGroup := definitions.AlertRuleGroup{
			Title:     "123",
			FolderUID: "123",
			Interval:  10,
			Rules: []definitions.ProvisionedAlertRule{
				{
					UID:          "1",
					Condition:    "A",
					ExecErrState: definitions.ErrorErrState,
					NoDataState:  definitions.NoData,
					For:          10,
					NotificationSettings: &definitions.AlertRuleNotificationSettings{
						Receiver: "receiver",
					},
					Record: &definitions.Record{
						Metric: "metric",
						From:   "A",
					},
				},
			},
		}
		tm, err := AlertRuleGroupFromApiAlertRuleGroup(ruleGroup)
		require.NoError(t, err)
		require.Len(t, tm.Rules, 1)
		rule := tm.Rules[0]
		require.Empty(t, rule.NoDataState)
		require.Empty(t, rule.For)
		require.Empty(t, rule.Condition)
		require.Empty(t, rule.ExecErrState)
		require.Nil(t, rule.NotificationSettings)
	})
}

func TestAlertRuleMetadataFromModelMetadata(t *testing.T) {
	t.Run("should convert model metadata to api metadata", func(t *testing.T) {
		modelMetadata := models.AlertRuleMetadata{
			EditorSettings: models.EditorSettings{
				SimplifiedQueryAndExpressionsSection: true,
				SimplifiedNotificationsSection:       true,
			},
		}

		apiMetadata := AlertRuleMetadataFromModelMetadata(modelMetadata)

		require.True(t, apiMetadata.EditorSettings.SimplifiedQueryAndExpressionsSection)
		require.True(t, apiMetadata.EditorSettings.SimplifiedNotificationsSection)
	})
}

func TestExportWithTemplateStringsInLabels(t *testing.T) {
	t.Run("should export alert rule with template strings in labels", func(t *testing.T) {
		rule := models.AlertRule{
			Title: "Test",
			Labels: map[string]string{
				"test":      "{{ $labels.Test }}   with another reference to {{ $labels.Test }}",
				"test2":     "value",
				"multiline": "{{ $labels.Test }} on line1\n{{ $labels.Test2 }}line2",
				"dollars":   "$50",
			},
			Annotations: map[string]string{
				"test": "{{ $labels.Test }}",
			},
		}

		exportedRule, err := AlertRuleExportFromAlertRule(rule)

		require.NoError(t, err)

		require.Equal(t, "Test", exportedRule.Title)
		require.Equal(t, map[string]string{
			"test":      "{{ $$labels.Test }}   with another reference to {{ $$labels.Test }}",
			"test2":     "value",
			"multiline": "{{ $$labels.Test }} on line1\n{{ $$labels.Test2 }}line2",
			"dollars":   "$$50",
		}, *exportedRule.Labels)
		require.Equal(t, map[string]string{
			"test": "{{ $labels.Test }}",
		}, *exportedRule.Annotations)
	})
}
