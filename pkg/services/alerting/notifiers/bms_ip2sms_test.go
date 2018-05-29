test.go
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
	}
}
}
