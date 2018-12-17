package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestICQNotifier(t *testing.T) {
	Convey("ICQ notifier tests", t, func() {

		Convey("When parsing settings", func() {
			notifierName := "icq_testing"
			notifierType := "icq"

			Convey("Empty settings should return error", func() {
				settings, _ := simplejson.NewJson([]byte((`{ }`)))
				model := &models.AlertNotification{
					Name:     notifierName,
					Type:     notifierType,
					Settings: settings,
				}
				_, err := NewICQNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("Settings should trigger incident", func() {
				bottoken := "123.1234567890.0123456789:123456789"
				chatid := "123456789@chat.agent"
				json := `{
					"bottoken": "` + bottoken + `",
					"chatid": "` + chatid + `"
				}`

				settings, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     notifierName,
					Type:     notifierType,
					Settings: settings,
				}

				notifier, err := NewICQNotifier(model)
				icqNotifier := notifier.(*ICQNotifier)

				So(err, ShouldBeNil)
				So(icqNotifier.Name, ShouldEqual, notifierName)
				So(icqNotifier.Type, ShouldEqual, notifierType)
				So(icqNotifier.BotToken, ShouldEqual, bottoken)
				So(icqNotifier.ChatID, ShouldEqual, chatid)
			})
		})

		Convey("When generating a message", func() {
			evalContext := alerting.NewEvalContext(
				context.Background(),
				&alerting.Rule{
					Name:    "This is an alarm",
					Message: "Some kind of message.",
					State:   models.AlertStateAlerting,
				})
			evalContext.ImagePublicUrl = "http://grafa.url/image"

			Convey("Message should contain details", func() {
				message := message(evalContext, true)
				So(message, ShouldContainSubstring, evalContext.Rule.Message)
				So(message, ShouldContainSubstring, "[Alerting] "+evalContext.Rule.Name)
				So(message, ShouldContainSubstring, "Image: "+evalContext.ImagePublicUrl)
			})

			Convey("Image URL should be skipped if not necessary", func() {
				message := message(evalContext, false)
				So(message, ShouldNotContainSubstring, evalContext.ImagePublicUrl)
			})
		})
	})
}
