package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDingDingNotifier(t *testing.T) {
	Convey("Dingding notifier tests", t, func() {
		Convey("empty settings should return error", func() {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "dingding_testing",
				Type:     "dingding",
				Settings: settingsJSON,
			}

			_, err := newDingDingNotifier(model)
			So(err, ShouldNotBeNil)

		})
		Convey("settings should trigger incident", func() {
			json := `{ "url": "https://www.google.com" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "dingding_testing",
				Type:     "dingding",
				Settings: settingsJSON,
			}

			not, err := newDingDingNotifier(model)
			notifier := not.(*DingDingNotifier)

			So(err, ShouldBeNil)
			So(notifier.Name, ShouldEqual, "dingding_testing")
			So(notifier.Type, ShouldEqual, "dingding")
			So(notifier.URL, ShouldEqual, "https://www.google.com")
		})
	})
}
