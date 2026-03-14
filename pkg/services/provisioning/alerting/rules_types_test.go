package alerting

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
	"github.com/grafana/grafana/pkg/util"
)

func TestRuleGroup(t *testing.T) {
	t.Run("a valid rule group should not error", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		_, err := rg.MapToModel()
		require.NoError(t, err)
	})
	t.Run("a rule group with out a name should error", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		var name values.StringValue
		err := yaml.Unmarshal([]byte(""), &name)
		require.NoError(t, err)
		rg.Name = name
		_, err = rg.MapToModel()
		require.Error(t, err)
	})
	t.Run("a rule group with out a folder should error", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		var folder values.StringValue
		err := yaml.Unmarshal([]byte(""), &folder)
		require.NoError(t, err)
		rg.Folder = folder
		_, err = rg.MapToModel()
		require.Error(t, err)
	})
	t.Run("a rule group with out an interval should error", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		var interval values.StringValue
		err := yaml.Unmarshal([]byte(""), &interval)
		require.NoError(t, err)
		rg.Interval = interval
		_, err = rg.MapToModel()
		require.Error(t, err)
	})
	t.Run("a rule group with an invalid interval should error", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		var interval values.StringValue
		err := yaml.Unmarshal([]byte("10x"), &interval)
		require.NoError(t, err)
		rg.Interval = interval
		_, err = rg.MapToModel()
		require.Error(t, err)
	})
	t.Run("a rule group with an interval containing 'd' should work", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		var interval values.StringValue
		err := yaml.Unmarshal([]byte("2d"), &interval)
		require.NoError(t, err)
		rg.Interval = interval
		rgMapped, err := rg.MapToModel()
		require.NoError(t, err)
		require.Equal(t, int64(48*time.Hour/time.Second), rgMapped.Interval)
	})
	t.Run("a rule group with an empty org id should default to 1", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		rg.OrgID = values.Int64Value{}
		rgMapped, err := rg.MapToModel()
		require.NoError(t, err)
		require.Equal(t, int64(1), rgMapped.OrgID)
	})
	t.Run("a rule group with a negative org id should default to 1", func(t *testing.T) {
		rg := validRuleGroupV1(t)
		orgID := values.Int64Value{}
		err := yaml.Unmarshal([]byte("-1"), &orgID)
		require.NoError(t, err)
		rg.OrgID = orgID
		rgMapped, err := rg.MapToModel()
		require.NoError(t, err)
		require.Equal(t, int64(1), rgMapped.OrgID)
	})
}

func TestRules(t *testing.T) {
	t.Run("a valid rule should not error", func(t *testing.T) {
		rule := validRuleV1(t)
		_, err := rule.mapToModel(1)
		require.NoError(t, err)
	})
	t.Run("a rule with out a uid should error", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.UID = values.StringValue{}
		_, err := rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with out a title should error", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.Title = values.StringValue{}
		_, err := rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule without a for duration should default to 0s", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.For = values.StringValue{}
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, time.Duration(0), ruleMapped.For)
	})
	t.Run("a rule with an invalid for duration should error", func(t *testing.T) {
		rule := validRuleV1(t)
		forDuration := values.StringValue{}
		err := yaml.Unmarshal([]byte("10x"), &forDuration)
		rule.For = forDuration
		require.NoError(t, err)
		_, err = rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with a for duration containing 'd' should work", func(t *testing.T) {
		rule := validRuleV1(t)
		forDuration := values.StringValue{}
		err := yaml.Unmarshal([]byte("2d"), &forDuration)
		rule.For = forDuration
		require.NoError(t, err)
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, 48*time.Hour, ruleMapped.For)
	})
	t.Run("a rule with out a condition should error", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.Condition = values.StringValue{}
		_, err := rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with out data should error", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.Data = []QueryV1{}
		_, err := rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with out execErrState should have sane defaults", func(t *testing.T) {
		rule := validRuleV1(t)
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, ruleMapped.ExecErrState, models.AlertingErrState)
	})
	t.Run("a rule with invalid execErrState should error", func(t *testing.T) {
		rule := validRuleV1(t)
		execErrState := values.StringValue{}
		err := yaml.Unmarshal([]byte("abc"), &execErrState)
		require.NoError(t, err)
		rule.ExecErrState = execErrState
		_, err = rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with a valid execErrState should map it correctly", func(t *testing.T) {
		rule := validRuleV1(t)
		execErrState := values.StringValue{}
		err := yaml.Unmarshal([]byte(models.OkErrState), &execErrState)
		require.NoError(t, err)
		rule.ExecErrState = execErrState
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, ruleMapped.ExecErrState, models.OkErrState)
	})
	t.Run("a rule with out noDataState should have sane defaults", func(t *testing.T) {
		rule := validRuleV1(t)
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, ruleMapped.NoDataState, models.NoData)
	})
	t.Run("a rule with an invalid noDataState should error", func(t *testing.T) {
		rule := validRuleV1(t)
		noDataState := values.StringValue{}
		err := yaml.Unmarshal([]byte("abc"), &noDataState)
		require.NoError(t, err)
		rule.NoDataState = noDataState
		_, err = rule.mapToModel(1)
		require.Error(t, err)
	})
	t.Run("a rule with a valid noDataState should map it correctly", func(t *testing.T) {
		rule := validRuleV1(t)
		noDataState := values.StringValue{}
		err := yaml.Unmarshal([]byte(models.NoData), &noDataState)
		require.NoError(t, err)
		rule.NoDataState = noDataState
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, ruleMapped.NoDataState, models.NoData)
	})
	t.Run("a rule with notification settings should map it correctly", func(t *testing.T) {
		rule := validRuleV1(t)
		rule.NotificationSettings = &NotificationSettingsV1{
			Receiver: stringToStringValue("test-receiver"),
		}
		ruleMapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.NotNil(t, ruleMapped.NotificationSettings)
		require.Equal(t, models.NotificationSettingsFromContact(models.ContactPointRouting{Receiver: "test-receiver"}), *ruleMapped.NotificationSettings)
	})
}

func TestAnnotationsAndLabelsEnvVarSubstitution(t *testing.T) {
	t.Run("annotations should expand environment variables", func(t *testing.T) {
		t.Setenv("RUNBOOK_URL", "https://runbooks.example.com/alert-1")
		t.Setenv("DASHBOARD_UID", "abc123")

		rule := validRuleV1(t)
		var annotations values.StringMapValue
		doc := "runbook_url: $RUNBOOK_URL\ndashboard_uid: $DASHBOARD_UID\nstatic: no-expansion-needed"
		err := yaml.Unmarshal([]byte(doc), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "https://runbooks.example.com/alert-1", mapped.Annotations["runbook_url"])
		require.Equal(t, "abc123", mapped.Annotations["dashboard_uid"])
		require.Equal(t, "no-expansion-needed", mapped.Annotations["static"])
	})

	t.Run("labels should expand environment variables", func(t *testing.T) {
		t.Setenv("TEAM_NAME", "platform-infra")
		t.Setenv("ENV_LABEL", "production")

		rule := validRuleV1(t)
		var labels values.StringMapValue
		doc := "team: $TEAM_NAME\nenvironment: $ENV_LABEL\nseverity: warning"
		err := yaml.Unmarshal([]byte(doc), &labels)
		require.NoError(t, err)
		rule.Labels = labels

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "platform-infra", mapped.Labels["team"])
		require.Equal(t, "production", mapped.Labels["environment"])
		require.Equal(t, "warning", mapped.Labels["severity"])
	})

	t.Run("annotations and labels should both expand env vars in the same rule", func(t *testing.T) {
		t.Setenv("ALERT_SUMMARY", "CPU usage exceeded threshold")
		t.Setenv("ALERT_TEAM", "sre-oncall")

		rule := validRuleV1(t)

		var annotations values.StringMapValue
		err := yaml.Unmarshal([]byte("summary: $ALERT_SUMMARY"), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		var labels values.StringMapValue
		err = yaml.Unmarshal([]byte("team: $ALERT_TEAM"), &labels)
		require.NoError(t, err)
		rule.Labels = labels

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "CPU usage exceeded threshold", mapped.Annotations["summary"])
		require.Equal(t, "sre-oncall", mapped.Labels["team"])
	})

	t.Run("annotations should handle escaped dollar signs", func(t *testing.T) {
		t.Setenv("REAL_VAR", "expanded")

		rule := validRuleV1(t)
		var annotations values.StringMapValue
		err := yaml.Unmarshal([]byte("escaped: $$LITERAL\nreal: $REAL_VAR"), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "$LITERAL", mapped.Annotations["escaped"])
		require.Equal(t, "expanded", mapped.Annotations["real"])
	})

	t.Run("annotations should expand to empty string for unset env vars", func(t *testing.T) {
		rule := validRuleV1(t)
		var annotations values.StringMapValue
		err := yaml.Unmarshal([]byte("missing: $NONEXISTENT_VAR_84250\npresent: literal"), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "", mapped.Annotations["missing"])
		require.Equal(t, "literal", mapped.Annotations["present"])
	})

	t.Run("annotations should expand multiple env vars in a single value", func(t *testing.T) {
		t.Setenv("PROTO", "https")
		t.Setenv("HOST", "grafana.local")
		t.Setenv("PORT", "3000")

		rule := validRuleV1(t)
		var annotations values.StringMapValue
		err := yaml.Unmarshal([]byte("url: $PROTO://$HOST:$PORT/dashboards"), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Equal(t, "https://grafana.local:3000/dashboards", mapped.Annotations["url"])
	})

	t.Run("empty annotations map should not error", func(t *testing.T) {
		rule := validRuleV1(t)
		mapped, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.Empty(t, mapped.Annotations)
	})
}

func TestAnnotationsInRuleGroup(t *testing.T) {
	t.Run("annotations env vars should expand through rule group mapping", func(t *testing.T) {
		t.Setenv("GROUP_ANNOTATION", "provisioned-via-yaml")

		rg := validRuleGroupV1(t)
		rule := validRuleV1(t)

		var annotations values.StringMapValue
		err := yaml.Unmarshal([]byte("source: $GROUP_ANNOTATION"), &annotations)
		require.NoError(t, err)
		rule.Annotations = annotations

		rg.Rules = []AlertRuleV1{rule}
		mapped, err := rg.MapToModel()
		require.NoError(t, err)
		require.Len(t, mapped.Rules, 1)
		require.Equal(t, "provisioned-via-yaml", mapped.Rules[0].Annotations["source"])
	})

	t.Run("multiple rules in group should each expand annotation env vars", func(t *testing.T) {
		t.Setenv("ANNOT_ONE", "first-value")
		t.Setenv("ANNOT_TWO", "second-value")

		rg := validRuleGroupV1(t)

		rule1 := validRuleV1(t)
		rule1.UID = stringToStringValue("uid_1")
		rule1.Title = stringToStringValue("rule_1")
		var ann1 values.StringMapValue
		err := yaml.Unmarshal([]byte("desc: $ANNOT_ONE"), &ann1)
		require.NoError(t, err)
		rule1.Annotations = ann1

		rule2 := validRuleV1(t)
		rule2.UID = stringToStringValue("uid_2")
		rule2.Title = stringToStringValue("rule_2")
		var ann2 values.StringMapValue
		err = yaml.Unmarshal([]byte("desc: $ANNOT_TWO"), &ann2)
		require.NoError(t, err)
		rule2.Annotations = ann2

		rg.Rules = []AlertRuleV1{rule1, rule2}
		mapped, err := rg.MapToModel()
		require.NoError(t, err)
		require.Len(t, mapped.Rules, 2)
		require.Equal(t, "first-value", mapped.Rules[0].Annotations["desc"])
		require.Equal(t, "second-value", mapped.Rules[1].Annotations["desc"])
	})
}

func TestRecordingRules(t *testing.T) {
	t.Run("a valid rule should not error", func(t *testing.T) {
		rule := validRecordingRuleV1(t)
		_, err := rule.mapToModel(1)
		require.NoError(t, err)
	})

	t.Run("a valid rule with empty targetDatasourceUid should not error", func(t *testing.T) {
		rule := validRecordingRuleV1(t)
		rule.Record.TargetDatasourceUID = stringToStringValue("")
		model, err := rule.mapToModel(1)
		require.NoError(t, err)
		require.NotNil(t, model.Record)
		require.Equal(t, "", model.Record.TargetDatasourceUID)
	})
}

func TestNotificationsSettingsV1MapToModel(t *testing.T) {
	tests := []struct {
		name     string
		input    NotificationSettingsV1
		expected models.NotificationSettings
		wantErr  bool
	}{
		{
			name: "Valid Input",
			input: NotificationSettingsV1{
				Receiver:            stringToStringValue("test-receiver"),
				GroupBy:             []values.StringValue{stringToStringValue("test-group_by")},
				GroupWait:           stringToStringValue("1s"),
				GroupInterval:       stringToStringValue("2s"),
				RepeatInterval:      stringToStringValue("3s"),
				MuteTimeIntervals:   []values.StringValue{stringToStringValue("test-mute")},
				ActiveTimeIntervals: []values.StringValue{stringToStringValue("test-active")},
			},
			expected: models.NotificationSettingsFromContact(models.ContactPointRouting{
				Receiver:            "test-receiver",
				GroupBy:             []string{"test-group_by"},
				GroupWait:           util.Pointer(model.Duration(1 * time.Second)),
				GroupInterval:       util.Pointer(model.Duration(2 * time.Second)),
				RepeatInterval:      util.Pointer(model.Duration(3 * time.Second)),
				MuteTimeIntervals:   []string{"test-mute"},
				ActiveTimeIntervals: []string{"test-active"},
			}),
		},
		{
			name: "Skips empty elements in group_by",
			input: NotificationSettingsV1{
				Receiver: stringToStringValue("test-receiver"),
				GroupBy:  []values.StringValue{stringToStringValue("test-group_by1"), stringToStringValue(""), stringToStringValue("test-group_by2")},
			},
			expected: models.NotificationSettingsFromContact(models.ContactPointRouting{
				Receiver: "test-receiver",
				GroupBy:  []string{"test-group_by1", "test-group_by2"},
			}),
		},
		{
			name: "Skips empty elements in mute timings",
			input: NotificationSettingsV1{
				Receiver:          stringToStringValue("test-receiver"),
				MuteTimeIntervals: []values.StringValue{stringToStringValue("test-mute1"), stringToStringValue(""), stringToStringValue("test-mute2")},
			},
			expected: models.NotificationSettingsFromContact(models.ContactPointRouting{
				Receiver:          "test-receiver",
				MuteTimeIntervals: []string{"test-mute1", "test-mute2"},
			}),
		},
		{
			name: "Empty Receiver",
			input: NotificationSettingsV1{
				Receiver: stringToStringValue(""),
			},
			wantErr: true,
		},
		{
			name: "Invalid GroupWait Duration",
			input: NotificationSettingsV1{
				Receiver:  stringToStringValue("test-receiver"),
				GroupWait: stringToStringValue("invalidDuration"),
			},
			wantErr: true,
		},
		{
			name: "Invalid GroupInterval Duration",
			input: NotificationSettingsV1{
				Receiver:      stringToStringValue("test-receiver"),
				GroupInterval: stringToStringValue("invalidDuration"),
			},
			wantErr: true,
		},
		{
			name: "Invalid RepeatInterval Duration",
			input: NotificationSettingsV1{
				Receiver:      stringToStringValue("test-receiver"),
				GroupInterval: stringToStringValue("invalidDuration"),
			},
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.input.mapToModel()
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.Equal(t, tc.expected, got)
		})
	}
}

func validRuleGroupV1(t *testing.T) AlertRuleGroupV1 {
	t.Helper()

	var orgID values.Int64Value
	err := yaml.Unmarshal([]byte("1"), &orgID)
	require.NoError(t, err)

	return AlertRuleGroupV1{
		OrgID:    orgID,
		Name:     stringToStringValue("Test"),
		Folder:   stringToStringValue("Test"),
		Interval: stringToStringValue("10s"),
		Rules:    []AlertRuleV1{},
	}
}

func validRuleV1(t *testing.T) AlertRuleV1 {
	t.Helper()

	return AlertRuleV1{
		Title:     stringToStringValue("test"),
		UID:       stringToStringValue("test_uid"),
		For:       stringToStringValue("10s"),
		Condition: stringToStringValue("A"),
		Data:      []QueryV1{{}},
	}
}

func validRecordingRuleV1(t *testing.T) AlertRuleV1 {
	t.Helper()

	return AlertRuleV1{
		Title: stringToStringValue("test"),
		UID:   stringToStringValue("test_uid"),
		For:   stringToStringValue("10s"),
		Record: &RecordV1{
			Metric:              stringToStringValue("test_metric"),
			From:                stringToStringValue("A"),
			TargetDatasourceUID: stringToStringValue("test_target_datasource"),
		},
		Data: []QueryV1{{}},
	}
}

func stringToStringValue(s string) values.StringValue {
	result := values.StringValue{}
	err := yaml.Unmarshal([]byte(s), &result)
	if err != nil {
		panic(err)
	}
	return result
}
