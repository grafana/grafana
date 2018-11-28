package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

var (
	fakeRepo *fakeRepository
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
	Convey("Testing alert rule", t, func() {

		RegisterCondition("test", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		Convey("should return err for empty string", func() {
			_, err := getTimeDurationStringToSeconds("")
			So(err, ShouldNotBeNil)
		})

		Convey("can construct alert rule model", func() {
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
					{"id": 1134},
					{"id": 22}
				]
			}
			`

			alertJSON, jsonErr := simplejson.NewJson([]byte(json))
			So(jsonErr, ShouldBeNil)

			alert := &m.Alert{
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

			alert := &m.Alert{
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
		Convey("can construct alert rule model mixed notification ids and names", func() {
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
					{"id": 1134},
					{"id": 22},
					{"name": "channel1"},
					{"name": "channel2"}
				]
			}
			`

			alertJSON, jsonErr := simplejson.NewJson([]byte(json))
			So(jsonErr, ShouldBeNil)

			alert := &m.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,

				Settings: alertJSON,
			}

			fakeRepo = &fakeRepository{}
			bus.ClearBusHandlers()
			bus.AddHandler("test", mockGet)

			fakeRepo.loadAll = []*models.AlertNotification{
				{Name: "channel1", OrgId: 1, Id: 1},
				{Name: "channel2", OrgId: 1, Id: 2},
			}

			alertRule, err := NewRuleFromDBAlert(alert)
			So(err, ShouldBeNil)

			Convey("Can read notifications", func() {
				So(len(alertRule.Notifications), ShouldEqual, 4)
				So(alertRule.Notifications, ShouldResemble, []int64{1134, 22, 1, 2})
			})
		})

		Convey("raise error in case of left id", func() {
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
					{"not_id": 1134}
				]
			}
			`

			alertJSON, jsonErr := simplejson.NewJson([]byte(json))
			So(jsonErr, ShouldBeNil)

			alert := &m.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,

				Settings: alertJSON,
			}

			_, err := NewRuleFromDBAlert(alert)
			So(err, ShouldNotBeNil)
		})

		Convey("raise error in case of left id but existed name with alien orgId", func() {
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
					{"not_id": 1134, "name": "channel1"}
				]
			}
			`

			alertJSON, jsonErr := simplejson.NewJson([]byte(json))
			So(jsonErr, ShouldBeNil)

			alert := &m.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,

				Settings: alertJSON,
			}

			fakeRepo = &fakeRepository{}
			bus.ClearBusHandlers()
			bus.AddHandler("test", mockGet)

			fakeRepo.loadAll = []*models.AlertNotification{
				{Name: "channel1", OrgId: 2, Id: 1},
			}

			_, err := NewRuleFromDBAlert(alert)

			So(err, ShouldNotBeNil)
		})
	})
}

type fakeRepository struct {
	loadAll []*models.AlertNotification
}

func mockGet(cmd *models.GetAlertNotificationsQuery) error {
	for _, v := range fakeRepo.loadAll {
		if cmd.Name == v.Name && cmd.OrgId == v.OrgId {
			cmd.Result = v
			return nil
		}
	}
	return nil
}
