package alerting

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type FakeCondition struct{}

func (f *FakeCondition) Eval(context *EvalContext, reqHandler legacydata.RequestHandler) (*ConditionResult, error) {
	return &ConditionResult{}, nil
}

func TestAlertRuleFrequencyParsing(t *testing.T) {
	tcs := []struct {
		input  string
		err    error
		result int64
	}{
		{input: "10s", result: 10},
		{input: "10m", result: 600},
		{input: "1h", result: 3600},
		{input: "1d", result: 86400},
		{input: "1o", err: ErrWrongUnitFormat},
		{input: "0s", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0m", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0h", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0", err: ErrFrequencyCouldNotBeParsed},
		{input: "", err: ErrFrequencyCouldNotBeParsed},
		{input: "-1s", err: ErrFrequencyCouldNotBeParsed},
	}

	for _, tc := range tcs {
		t.Run(tc.input, func(t *testing.T) {
			r, err := getTimeDurationStringToSeconds(tc.input)
			if tc.err == nil {
				require.NoError(t, err)
			} else {
				require.EqualError(t, err, tc.err.Error())
			}
			assert.Equal(t, tc.result, r)
		})
	}
}

func TestAlertRuleForParsing(t *testing.T) {
	tcs := []struct {
		input  string
		err    error
		result time.Duration
	}{
		{input: "10s", result: time.Duration(10000000000)},
		{input: "10m", result: time.Duration(600000000000)},
		{input: "1h", result: time.Duration(3600000000000)},
		{input: "1o", err: fmt.Errorf("alert validation error: could not parse for field, error: %s", ErrWrongUnitFormat)},
		{input: "1", err: fmt.Errorf("alert validation error: no specified unit, error: %s", ErrWrongUnitFormat)},
		{input: "0s", result: time.Duration(0)},
		{input: "0m", result: time.Duration(0)},
		{input: "0h", result: time.Duration(0)},
		{input: "0", result: time.Duration(0)},
		{input: "", result: time.Duration(0)},
	}

	for _, tc := range tcs {
		t.Run(tc.input, func(t *testing.T) {
			r, err := getForValue(tc.input)
			if tc.err == nil {
				require.NoError(t, err)
			} else {
				require.EqualError(t, err, tc.err.Error())
			}
			assert.Equal(t, tc.result, r)
		})
	}
}

func TestAlertRuleModel(t *testing.T) {
	sqlStore := &sqlStore{db: db.InitTestDB(t), cache: localcache.New(time.Minute, time.Minute)}
	RegisterCondition("test", func(model *simplejson.Json, index int) (Condition, error) {
		return &FakeCondition{}, nil
	})

	firstNotification := models.CreateAlertNotificationCommand{UID: "notifier1", OrgID: 1, Name: "1"}
	_, err := sqlStore.CreateAlertNotificationCommand(context.Background(), &firstNotification)
	require.Nil(t, err)
	secondNotification := models.CreateAlertNotificationCommand{UID: "notifier2", OrgID: 1, Name: "2"}
	_, err = sqlStore.CreateAlertNotificationCommand(context.Background(), &secondNotification)
	require.Nil(t, err)

	t.Run("Testing alert rule with notification id and uid", func(t *testing.T) {
		json := `
				{
					"name": "name2",
					"description": "desc2",
					"handler": 0,
					"noDataMode": "critical",
					"enabled": true,
					"frequency": "60s",
					"conditions": [
						{
							"type": "test",
							"prop": 123
						}
					],
					"notifications": [
						{"id": 1},
						{"uid": "notifier2"}
					]
				}
				`

		alertJSON, jsonErr := simplejson.NewJson([]byte(json))
		require.Nil(t, jsonErr)

		alert := &models.Alert{
			ID:          1,
			OrgID:       1,
			DashboardID: 1,
			PanelID:     1,

			Settings: alertJSON,
		}

		alertRule, err := NewRuleFromDBAlert(context.Background(), sqlStore, alert, false)
		require.Nil(t, err)

		require.Len(t, alertRule.Conditions, 1)
		require.Len(t, alertRule.Notifications, 2)

		require.Contains(t, alertRule.Notifications, "notifier2")
		require.Contains(t, alertRule.Notifications, "notifier1")
	})

	t.Run("Testing alert rule with non existing notification id", func(t *testing.T) {
		json := `
				{
					"name": "name3",
					"description": "desc3",
					"handler": 0,
					"noDataMode": "critical",
					"enabled": true,
					"frequency": "60s",
					"conditions": [{"type": "test", "prop": 123 }],
					"notifications": [
						{"id": 999},
						{"uid": "notifier2"}
					]
				}
				`

		alertJSON, jsonErr := simplejson.NewJson([]byte(json))
		require.Nil(t, jsonErr)

		alert := &models.Alert{
			ID:          1,
			OrgID:       1,
			DashboardID: 1,
			PanelID:     1,

			Settings: alertJSON,
		}

		alertRule, err := NewRuleFromDBAlert(context.Background(), sqlStore, alert, false)
		require.Nil(t, err)
		require.NotContains(t, alertRule.Notifications, "999")
		require.Contains(t, alertRule.Notifications, "notifier2")
	})

	t.Run("Testing alert rule which can construct alert rule model with invalid frequency", func(t *testing.T) {
		json := `
			{
				"name": "name2",
				"description": "desc2",
				"noDataMode": "critical",
				"enabled": true,
				"frequency": "0s",
				"conditions": [ { "type": "test", "prop": 123 } ],
				"notifications": []
			}`

		alertJSON, jsonErr := simplejson.NewJson([]byte(json))
		require.Nil(t, jsonErr)

		alert := &models.Alert{
			ID:          1,
			OrgID:       1,
			DashboardID: 1,
			PanelID:     1,
			Frequency:   0,

			Settings: alertJSON,
		}

		alertRule, err := NewRuleFromDBAlert(context.Background(), sqlStore, alert, false)
		require.Nil(t, err)
		require.EqualValues(t, alertRule.Frequency, 60)
	})

	t.Run("Testing alert rule which will raise error in case of missing notification id and uid", func(t *testing.T) {
		json := `
			{
				"name": "name2",
				"description": "desc2",
				"noDataMode": "critical",
				"enabled": true,
				"frequency": "60s",
				"conditions": [
					{
						"type": "test",
						"prop": 123
					}
				],
				"notifications": [
					{"not_id_uid": "1134"}
				]
			}
			`

		alertJSON, jsonErr := simplejson.NewJson([]byte(json))
		require.Nil(t, jsonErr)

		alert := &models.Alert{
			ID:          1,
			OrgID:       1,
			DashboardID: 1,
			PanelID:     1,
			Frequency:   0,

			Settings: alertJSON,
		}

		_, err := NewRuleFromDBAlert(context.Background(), sqlStore, alert, false)
		require.NotNil(t, err)
		require.EqualValues(t, err.Error(), "alert validation error: Neither id nor uid is specified in 'notifications' block, type assertion to string failed AlertId: 1 PanelId: 1 DashboardId: 1")
	})
}
