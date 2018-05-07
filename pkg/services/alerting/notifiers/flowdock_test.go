package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestFlowdockNotifier(t *testing.T) {
	Convey("Flowdock notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "flowdock_testing",
					Type:     "flowdock",
					Settings: settingsJSON,
				}

				_, err := NewFlowdockNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings with flowToken should return notifier", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &m.AlertNotification{
					Name:     "flowdock_testing",
					Type:     "flowdock",
					Settings: settingsJSON,
				}

				not, err := NewFlowdockNotifier(model)
				flowdockNotifier := not.(*FlowdockNotifier)

				So(err, ShouldBeNil)
				So(flowdockNotifier.FlowToken, ShouldEqual, "abcd1234")
			})
		})
	})
}
