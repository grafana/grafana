package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPagerdutyNotifier(t *testing.T) {
	Convey("Pagerduty notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "pageduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				_, err := NewPagerdutyNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings with only integrationKey should contain AlertStateAlerting", func() {
				json := `
				{
          "integrationKey": "abcdefgh0123456789"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateAlerting)
			})

			Convey("settings with alertOnNoData should contain AlertStateNoData too", func() {
				json := `
				{
          "integrationKey": "abcdefgh0123456789",
          "alertOnNoData": true
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateNoData)
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateAlerting)
			})

			Convey("settings with alertOnNoData, alertOnExecError should contain both", func() {
				json := `
				{
          "integrationKey": "abcdefgh0123456789",
          "alertOnNoData": true,
          "alertOnExecError": true
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateNoData)
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateAlerting)
				So(pagerdutyNotifier.AlertingStates, ShouldContain, m.AlertStateExecError)
			})

		})
	})
}
