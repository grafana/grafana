package api

import (
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
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
					UID:           "1",
					Condition:     "A",
					ExecErrState:  definitions.ErrorErrState,
					NoDataState:   definitions.NoData,
					For:           10,
					KeepFiringFor: 20,
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
		require.Empty(t, rule.KeepFiringFor)
		require.Empty(t, rule.Condition)
		require.Empty(t, rule.ExecErrState)
		require.Nil(t, rule.NotificationSettings)
	})

	t.Run("should copy the fields correctly", func(t *testing.T) {
		ruleGroup := definitions.AlertRuleGroup{
			Title:     "123",
			FolderUID: "456",
			Interval:  int64(10),
			Rules: []definitions.ProvisionedAlertRule{
				{
					UID:           "1",
					For:           prommodel.Duration(5 * time.Second),
					KeepFiringFor: prommodel.Duration(15 * time.Second),
				},
			},
		}

		tm, err := AlertRuleGroupFromApiAlertRuleGroup(ruleGroup)
		require.NoError(t, err)

		require.Equal(t, "123", tm.Title)
		require.Equal(t, "456", tm.FolderUID)
		require.Equal(t, int64(10), tm.Interval)
		require.Len(t, tm.Rules, 1)
		require.Equal(t, "1", tm.Rules[0].UID)
		require.Equal(t, time.Second*5, tm.Rules[0].For)
		require.Equal(t, time.Second*15, tm.Rules[0].KeepFiringFor)
	})

	t.Run("should handle empty keep firing for", func(t *testing.T) {
		ruleGroup := definitions.AlertRuleGroup{
			Title:     "123",
			FolderUID: "456",
			Interval:  int64(10),
			Rules: []definitions.ProvisionedAlertRule{
				{
					UID: "1",
				},
			},
		}
		tm, err := AlertRuleGroupFromApiAlertRuleGroup(ruleGroup)
		require.NoError(t, err)
		require.Equal(t, time.Duration(0), tm.Rules[0].KeepFiringFor)
	})
}

func TestAlertRuleExportFromAlertRule(t *testing.T) {
	alertingRule := models.RuleGen.With(
		models.RuleGen.WithNotEmptyLabels(2, "lbl-"),
		models.RuleGen.WithAnnotations(map[string]string{"ann-key": "ann-value"}),
		models.RuleGen.WithFor(2*time.Minute),
		models.RuleGen.WithKeepFiringFor(5*time.Minute),
		models.RuleGen.WithNotificationSettingsGen(models.NotificationSettingsGen()),
	).Generate()
	recordingRule := models.RuleGen.With(
		models.RuleGen.WithAllRecordingRules(),
		models.RuleGen.WithNotEmptyLabels(2, "lbl-"),
		models.RuleGen.WithAnnotations(map[string]string{"ann-key": "ann-value"}),
	).Generate()

	// Build expected exported recording rule
	recordingRuleData, err := AlertQueryExportFromAlertQuery(recordingRule.Data[0])
	require.NoError(t, err)
	expectedRecordingRuleExport := definitions.AlertRuleExport{
		UID:         recordingRule.UID,
		Title:       recordingRule.Title,
		Data:        []definitions.AlertQueryExport{recordingRuleData},
		Annotations: &recordingRule.Annotations,
		Labels:      &recordingRule.Labels,
		Record: &definitions.AlertRuleRecordExport{
			Metric:              recordingRule.Record.Metric,
			From:                recordingRule.Record.From,
			TargetDatasourceUID: util.Pointer(recordingRule.Record.TargetDatasourceUID),
		},
	}

	// Build expected exported alerting rule
	alertingRuleData, err := AlertQueryExportFromAlertQuery(alertingRule.Data[0])
	require.NoError(t, err)
	noDataState := definitions.NoDataState(alertingRule.NoDataState)
	execErrState := definitions.ExecutionErrorState(alertingRule.ExecErrState)
	expectedAlertingRuleExport := definitions.AlertRuleExport{
		UID:                         alertingRule.UID,
		Title:                       alertingRule.Title,
		Condition:                   &alertingRule.Condition,
		Data:                        []definitions.AlertQueryExport{alertingRuleData},
		DashboardUID:                alertingRule.DashboardUID,
		PanelID:                     alertingRule.PanelID,
		NoDataState:                 &noDataState,
		ExecErrState:                &execErrState,
		For:                         prommodel.Duration(alertingRule.For),
		KeepFiringFor:               prommodel.Duration(alertingRule.KeepFiringFor),
		ForString:                   util.Pointer(prommodel.Duration(alertingRule.For).String()),
		KeepFiringForString:         util.Pointer(prommodel.Duration(alertingRule.KeepFiringFor).String()),
		Annotations:                 &alertingRule.Annotations,
		Labels:                      &alertingRule.Labels,
		NotificationSettings:        AlertRuleNotificationSettingsExportFromNotificationSettings(alertingRule.NotificationSettings),
		MissingSeriesEvalsToResolve: alertingRule.MissingSeriesEvalsToResolve,
	}

	testCases := []struct {
		name     string
		rule     models.AlertRule
		expected definitions.AlertRuleExport
	}{
		{
			name:     "export recording rule",
			rule:     recordingRule,
			expected: expectedRecordingRuleExport,
		},
		{
			name:     "export alerting rule",
			rule:     alertingRule,
			expected: expectedAlertingRuleExport,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			exported, err := AlertRuleExportFromAlertRule(tc.rule)
			require.NoError(t, err)
			require.Equal(t, tc.expected, exported)
		})
	}
}

func TestAlertQueryExportFromAlertQuery(t *testing.T) {
	query := models.RuleGen.GenerateQuery()

	exported, err := AlertQueryExportFromAlertQuery(query)
	require.NoError(t, err)

	require.Equal(t, query.RefID, exported.RefID)
	require.Equal(t, query.DatasourceUID, exported.DatasourceUID)
	require.Equal(t, int64(time.Duration(query.RelativeTimeRange.From).Seconds()), exported.RelativeTimeRange.FromSeconds)
	require.Equal(t, int64(time.Duration(query.RelativeTimeRange.To).Seconds()), exported.RelativeTimeRange.ToSeconds)
	require.NotNil(t, exported.QueryType)
	require.Equal(t, query.QueryType, *exported.QueryType)
	require.NotNil(t, exported.Model)
	require.NotEmpty(t, exported.ModelString)
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

func TestApiAlertRuleGroupFromAlertRuleGroup(t *testing.T) {
	t.Run("should convert keepfiringfor duration correctly", func(t *testing.T) {
		keepFiringFor := 30 * time.Second
		modelGroup := models.AlertRuleGroup{
			Title:     "test_group",
			FolderUID: "folder123",
			Interval:  int64(10),
			Rules: []models.AlertRule{
				{
					UID:           "rule1",
					Title:         "Test Rule",
					For:           10 * time.Second,
					KeepFiringFor: keepFiringFor,
				},
			},
		}

		apiGroup := ApiAlertRuleGroupFromAlertRuleGroup(modelGroup)

		require.Equal(t, "test_group", apiGroup.Title)
		require.Equal(t, "folder123", apiGroup.FolderUID)
		require.Equal(t, int64(10), apiGroup.Interval)
		require.Len(t, apiGroup.Rules, 1)

		rule := apiGroup.Rules[0]
		require.Equal(t, "rule1", rule.UID)
		require.Equal(t, prommodel.Duration(keepFiringFor), rule.KeepFiringFor)
	})

	t.Run("handles empty keep_firing_for", func(t *testing.T) {
		modelGroup := models.AlertRuleGroup{
			Title:     "test_group",
			FolderUID: "folder123",
			Interval:  int64(10),
			Rules: []models.AlertRule{
				{
					UID:   "rule1",
					Title: "Test Rule",
					For:   10 * time.Second,
				},
			},
		}

		apiGroup := ApiAlertRuleGroupFromAlertRuleGroup(modelGroup)
		require.Len(t, apiGroup.Rules, 1)
		require.Equal(t, prommodel.Duration(0), apiGroup.Rules[0].KeepFiringFor)
	})
}
