package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWeChatNotifier(t *testing.T) {
	Convey("WeChat notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "wechat_testing",
					Type:     "wechat",
					Settings: settingsJSON,
				}

				_, err := NewWeChatNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings with agentid, corpid, secret, touser", func() {
				json := `
				{
					"agentid": "xxxx1",
					"corpid": "####1",
					"secret": "@@@@1",
					"touser": "oooo1"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "wechat_testing",
					Type:     "wechat",
					Settings: settingsJSON,
				}

				not, err := NewWeChatNotifier(model)
				wechatNotifier := not.(*WeChatNotifier)

				So(err, ShouldBeNil)
				So(wechatNotifier.Name, ShouldEqual, "wechat_testing")
				So(wechatNotifier.Type, ShouldEqual, "wechat")
				So(wechatNotifier.AgentId, ShouldEqual, "xxxx1")
				So(wechatNotifier.CorpId, ShouldEqual, "####1")
				So(wechatNotifier.Secret, ShouldEqual, "@@@@1")
				So(wechatNotifier.ToUser, ShouldEqual, "oooo1")
			})
		})
	})
}
