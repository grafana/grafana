package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWechatWorkNotifier(t *testing.T) {
	Convey("Wechat work notifier tests", t, func() {
		Convey("empty settings should return error", func() {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wechatwork_testing",
				Type:     "wechatwork",
				Settings: settingsJSON,
			}

			_, err := newWechatWorkNotifier(model)
			So(err, ShouldNotBeNil)

		})
		Convey("settings should trigger incident", func() {
			json := `{ "url": "https://www.google.com" }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "wechatwork_testing",
				Type:     "wechatwork",
				Settings: settingsJSON,
			}

			not, err := newWechatWorkNotifier(model)
			notifier := not.(*WechatWorkNotifier)

			So(err, ShouldBeNil)
			So(notifier.Name, ShouldEqual, "wechatwork_testing")
			So(notifier.Type, ShouldEqual, "wechatwork")
			So(notifier.URL, ShouldEqual, "https://www.google.com")
		})
	})
}
