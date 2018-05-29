package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestBMSNotifier(t *testing.T) {
	Convey("BMS notifier tests", t, func() {

		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "bms_testing",
					Type:     "bms",
					Settings: settingsJSON,
				}

				_, err := NewBMSNotifier(model)
				So(err, ShouldNotBeNil)
			})

	Convey("settings should trigger incident", func() {
				json := `
				{
                                        "alphaname": "TESTAI",
					"username": "user"
					"password": "pass"
					"msisdn": "3801144553"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "bms_testing",
					Type:     "bms",
					Settings: settingsJSON,
				}


			        not, err := NewBMSNotifier(model)
				bmsNotifier := not.(*BMSNotifier)

				So(err, ShouldBeNil)
				So(bmsNotifier.Name, ShouldEqual, "bms_testing")
				So(bmsNotifier.Type, ShouldEqual, "bms")
				So(bmsNotifier.Alphaname, ShouldEqual, "TESTAI")
				So(bmsNotifier.Username, ShouldEqual, "user")
				So(bmsNotifier.Password, ShouldEqual, "pass")
				So(bmsNotifier.Msisdn, ShouldEqual, "3801144553")
			})

			Convey("generateCaption should generate a message with all pertinent details", func() {
				evalContext := alerting.NewEvalContext(nil, &alerting.Rule{
					Name:    "This is an alarm",
					Message: "Some kind of message.",
					State:   m.AlertStateOK,
				})

				caption := generateImageCaption(evalContext, "http://grafa.url/abcdef", "")
				So(len(caption), ShouldBeLessThanOrEqualTo, 200)
				So(caption, ShouldContainSubstring, "Some kind of message.")
				So(caption, ShouldContainSubstring, "[OK] This is an alarm")
				So(caption, ShouldContainSubstring, "http://grafa.url/abcdef")
			})

			Convey("When generating a message", func() {

				Convey("URL should be skipped if it's too long", func() {
					evalContext := alerting.NewEvalContext(nil, &alerting.Rule{
						Name:    "This is an alarm",
						Message: "Some kind of message.",
						State:   m.AlertStateOK,
					})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/abcdefaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						"foo bar")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "Some kind of message.")
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldContainSubstring, "foo bar")
					So(caption, ShouldNotContainSubstring, "http")
				})

				Convey("Message should be trimmed if it's too long", func() {
					evalContext := alerting.NewEvalContext(nil, &alerting.Rule{
						Name:    "This is an alarm",
						Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise I will. Yes siree that's it.",
						State:   m.AlertStateOK,
					})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldContainSubstring, "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I promise ")
				})

				Convey("Metrics should be skipped if they don't fit", func() {
					evalContext := alerting.NewEvalContext(nil, &alerting.Rule{
						Name:    "This is an alarm",
						Message: "Some kind of message that is too long for appending to our pretty little message, this line is actually exactly 197 chars long and I will get there in the end I ",
						State:   m.AlertStateOK,
					})

					caption := generateImageCaption(evalContext,
						"http://grafa.url/foo",
						"foo bar long song")
					So(len(caption), ShouldBeLessThanOrEqualTo, 200)
					So(caption, ShouldContainSubstring, "[OK] This is an alarm")
					So(caption, ShouldNotContainSubstring, "http")
					So(caption, ShouldNotContainSubstring, "foo bar")
				})
			})
		})
	})
}
