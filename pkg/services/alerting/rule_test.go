package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

type FakeCondition struct{}

func (f *FakeCondition) Eval(context *EvalContext) (*ConditionResult, error) {
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
		{input: "1o", result: 1},
		{input: "0s", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0m", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0h", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "0", err: ErrFrequencyCannotBeZeroOrLess},
		{input: "-1s", err: ErrFrequencyCouldNotBeParsed},
	}

	for _, tc := range tcs {
		r, err := getTimeDurationStringToSeconds(tc.input)
		if err != tc.err {
			t.Errorf("expected error: '%v' got: '%v'", tc.err, err)
			return
		}

		if r != tc.result {
			t.Errorf("expected result: %d got %d", tc.result, r)
		}
	}
}

func TestAlertRuleModel(t *testing.T) {
	sqlstore.InitTestDB(t)
	Convey("Testing alert rule", t, func() {

		RegisterCondition("test", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		Convey("should return err for empty string", func() {
			_, err := getTimeDurationStringToSeconds("")
			So(err, ShouldNotBeNil)
		})

		Convey("can construct alert rule model", func() {
			firstNotification := models.CreateAlertNotificationCommand{OrgId: 1, Name: "1"}
			err := sqlstore.CreateAlertNotificationCommand(&firstNotification)
			So(err, ShouldBeNil)
			secondNotification := models.CreateAlertNotificationCommand{Uid: "notifier2", OrgId: 1, Name: "2"}
			err = sqlstore.CreateAlertNotificationCommand(&secondNotification)
			So(err, ShouldBeNil)

			Convey("with notification id and uid", func() {
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
				So(jsonErr, ShouldBeNil)

				alert := &models.Alert{
					Id:          1,
					OrgId:       1,
					DashboardId: 1,
					PanelId:     1,

					Settings: alertJSON,
				}

				alertRule, err := NewRuleFromDBAlert(alert)
				So(err, ShouldBeNil)

				So(len(alertRule.Conditions), ShouldEqual, 1)

				Convey("Can read notifications", func() {
					So(len(alertRule.Notifications), ShouldEqual, 2)
					So(alertRule.Notifications, ShouldContain, "000000001")
					So(alertRule.Notifications, ShouldContain, "notifier2")
				})
			})
		})

		Convey("can construct alert rule model with invalid frequency", func() {
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
			So(jsonErr, ShouldBeNil)

			alert := &models.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,
				Frequency:   0,

				Settings: alertJSON,
			}

			alertRule, err := NewRuleFromDBAlert(alert)
			So(err, ShouldBeNil)
			So(alertRule.Frequency, ShouldEqual, 60)
		})

		Convey("raise error in case of missing notification id and uid", func() {
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
			So(jsonErr, ShouldBeNil)

			alert := &models.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,
				Frequency:   0,

				Settings: alertJSON,
			}

			_, err := NewRuleFromDBAlert(alert)
			So(err, ShouldNotBeNil)
			So(err.Error(), ShouldEqual, "Alert validation error: Neither id nor uid is specified, type assertion to string failed AlertId: 1 PanelId: 1 DashboardId: 1")
		})
	})
}
