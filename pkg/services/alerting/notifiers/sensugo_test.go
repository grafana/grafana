package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSensuGoNotifier(t *testing.T) {
	Convey("Sensu Go notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, err := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)
				model := &models.AlertNotification{
					Name:     "Sensu Go",
					Type:     "sensugo",
					Settings: settingsJSON,
				}

				_, err = NewSensuGoNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"url": "http://sensu-api.example.com:8080",
					"entity": "grafana_instance_01",
					"check": "grafana_rule_0",
					"namespace": "default",
					"handler": "myhandler",
					"apikey": "abcdef0123456789abcdef"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Sensu Go",
					Type:     "sensugo",
					Settings: settingsJSON,
				}

				not, err := NewSensuGoNotifier(model)
				So(err, ShouldBeNil)
				sensuGoNotifier := not.(*SensuGoNotifier)

				So(sensuGoNotifier.Name, ShouldEqual, "Sensu Go")
				So(sensuGoNotifier.Type, ShouldEqual, "sensugo")
				So(sensuGoNotifier.URL, ShouldEqual, "http://sensu-api.example.com:8080")
				So(sensuGoNotifier.Entity, ShouldEqual, "grafana_instance_01")
				So(sensuGoNotifier.Check, ShouldEqual, "grafana_rule_0")
				So(sensuGoNotifier.Namespace, ShouldEqual, "default")
				So(sensuGoNotifier.Handler, ShouldEqual, "myhandler")
				So(sensuGoNotifier.APIKey, ShouldEqual, "abcdef0123456789abcdef")
			})
		})
	})
}
