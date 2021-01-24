package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWecomNotifier(t *testing.T) {
	Convey("Wecom notifier tests", t, func() {
		Convey("empty settings should return error", func() {
			json := `{ }`
			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: settingsJSON,
			}
			_, err := newWecomNotifier(model)
			So(err, ShouldNotBeNil)
		})
		Convey("settings should trigger incident", func() {
			json := `{ "webhook": "https://www.google.com" }`
			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: settingsJSON,
			}
			not, err := newWecomNotifier(model)
			notifier := not.(*WecomNotifier)
			So(err, ShouldBeNil)
			So(notifier.Name, ShouldEqual, "wecom_testing")
			So(notifier.Type, ShouldEqual, "wecom")
			So(notifier.Webhook, ShouldEqual, "https://www.google.com")

		})
	})
}
