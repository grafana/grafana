package alerting

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

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
		require.Len(t, ruleMapped.NotificationSettings, 1)
		require.Equal(t, models.NotificationSettings{Receiver: "test-receiver"}, ruleMapped.NotificationSettings[0])
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
			expected: models.NotificationSettings{
				Receiver:            "test-receiver",
				GroupBy:             []string{"test-group_by"},
				GroupWait:           util.Pointer(model.Duration(1 * time.Second)),
				GroupInterval:       util.Pointer(model.Duration(2 * time.Second)),
				RepeatInterval:      util.Pointer(model.Duration(3 * time.Second)),
				MuteTimeIntervals:   []string{"test-mute"},
				ActiveTimeIntervals: []string{"test-active"},
			},
		},
		{
			name: "Skips empty elements in group_by",
			input: NotificationSettingsV1{
				Receiver: stringToStringValue("test-receiver"),
				GroupBy:  []values.StringValue{stringToStringValue("test-group_by1"), stringToStringValue(""), stringToStringValue("test-group_by2")},
			},
			expected: models.NotificationSettings{
				Receiver: "test-receiver",
				GroupBy:  []string{"test-group_by1", "test-group_by2"},
			},
		},
		{
			name: "Skips empty elements in mute timings",
			input: NotificationSettingsV1{
				Receiver:          stringToStringValue("test-receiver"),
				MuteTimeIntervals: []values.StringValue{stringToStringValue("test-mute1"), stringToStringValue(""), stringToStringValue("test-mute2")},
			},
			expected: models.NotificationSettings{
				Receiver:          "test-receiver",
				MuteTimeIntervals: []string{"test-mute1", "test-mute2"},
			},
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
	var (
		orgID    values.Int64Value
		name     values.StringValue
		folder   values.StringValue
		interval values.StringValue
	)
	err := yaml.Unmarshal([]byte("1"), &orgID)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("Test"), &name)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("Test"), &folder)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("10s"), &interval)
	require.NoError(t, err)
	return AlertRuleGroupV1{
		OrgID:    orgID,
		Name:     name,
		Folder:   folder,
		Interval: interval,
		Rules:    []AlertRuleV1{},
	}
}

func validRuleV1(t *testing.T) AlertRuleV1 {
	t.Helper()
	var (
		title       values.StringValue
		uid         values.StringValue
		forDuration values.StringValue
		condition   values.StringValue
	)
	err := yaml.Unmarshal([]byte("test"), &title)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("test_uid"), &uid)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("10s"), &forDuration)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("A"), &condition)
	require.NoError(t, err)
	return AlertRuleV1{
		Title:     title,
		UID:       uid,
		For:       forDuration,
		Condition: condition,
		Data:      []QueryV1{{}},
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
