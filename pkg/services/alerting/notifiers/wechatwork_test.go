package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWechatWOrkNotifier(t *testing.T) {
	Convey("WeChat Work notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "test",
					Type:     "wechatwork",
					Settings: settingsJSON,
				}

				_, err := NewWechatWorkNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          			"url": "https://tencent.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "test",
					Type:     "wechatwork",
					Settings: settingsJSON,
				}

				not, err := NewWechatWorkNotifier(model)
				notifier := not.(*WechatWorkNotifier)

				So(err, ShouldBeNil)
				So(notifier.Name, ShouldEqual, "test")
				So(notifier.Type, ShouldEqual, "wechatwork")
				So(notifier.Url, ShouldEqual, "https://tencent.com")
				So(notifier.MsgType, ShouldEqual, "")
				So(notifier.Template, ShouldEqual, "")
			})

			Convey("from settings with parameters", func() {
				json := `
				{
          			"url": "https://tencent.com",
          			"msgtype": "text",
          			"template": "{title}"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "test",
					Type:     "wechatwork",
					Settings: settingsJSON,
				}

				not, err := NewWechatWorkNotifier(model)
				notifier := not.(*WechatWorkNotifier)

				So(err, ShouldBeNil)
				So(notifier.Name, ShouldEqual, "test")
				So(notifier.Type, ShouldEqual, "wechatwork")
				So(notifier.Url, ShouldEqual, "https://tencent.com")
				So(notifier.MsgType, ShouldEqual, "text")
				So(notifier.Template, ShouldEqual, "{title}")
			})
		})
	})
}
