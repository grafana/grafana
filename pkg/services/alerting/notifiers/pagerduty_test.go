package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPagerdutyNotifier(t *testing.T) {
	Convey("Pagerduty notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pageduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				_, err := NewPagerdutyNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("severity should override default", func() {
				json := `{ "integrationKey": "abcdefgh0123456789", "severity": "info" }`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
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
				So(pagerdutyNotifier.Severity, ShouldEqual, "info")
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})

			Convey("auto resolve and severity should have expected defaults", func() {
				json := `{ "integrationKey": "abcdefgh0123456789" }`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
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
				So(pagerdutyNotifier.Severity, ShouldEqual, "critical")
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
		  			"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
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
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})
		})
	})
}
