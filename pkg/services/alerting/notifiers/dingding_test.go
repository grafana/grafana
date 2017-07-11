package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDingDingNotifier(t *testing.T) {
	Convey("Line notifier tests", t, func() {
		Convey("empty settings should return error", func() {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &m.AlertNotification{
				Name:     "dingding_testing",
				Type:     "dingding",
				Settings: settingsJSON,
			}

			_, err := NewDingDingNotifier(model)
			So(err, ShouldNotBeNil)

		})
		Convey("settings should trigger incident", func() {
			json := `
			{
  "url": "https://www.google.com"
			}`
			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &m.AlertNotification{
				Name:     "dingding_testing",
				Type:     "dingding",
				Settings: settingsJSON,
			}

			not, err := NewDingDingNotifier(model)
			notifier := not.(*DingDingNotifier)

			So(err, ShouldBeNil)
			So(notifier.Name, ShouldEqual, "dingding_testing")
			So(notifier.Type, ShouldEqual, "dingding")
			So(notifier.Url, ShouldEqual, "https://www.google.com")
		})

	})
}
