package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestRundeckNotifier(t *testing.T) {
	Convey("Rundeck notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Rundeck",
					Type:     "rundeck",
					Settings: settingsJSON,
				}

				_, err := NewRundeckNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"url": "http://rundeck.example.com",
					"authtoken": "123456789",
					"jobid": "d203cc76-9bca-49e6-a3cf-1149dab45cf9"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Rundeck",
					Type:     "rundeck",
					Settings: settingsJSON,
				}

				not, err := NewRundeckNotifier(model)
				RundeckNotifier := not.(*RundeckNotifier)

				So(err, ShouldBeNil)
				So(RundeckNotifier.Name, ShouldEqual, "Rundeck")
				So(RundeckNotifier.Type, ShouldEqual, "rundeck")
				So(RundeckNotifier.URL, ShouldEqual, "http://rundeck.example.com/api/12/job/d203cc76-9bca-49e6-a3cf-1149dab45cf9/executions")
				So(RundeckNotifier.AuthToken, ShouldEqual, "123456789")
			})
		})
	})
}
