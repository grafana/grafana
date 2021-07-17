package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlibabaCloudSLSNotifier(t *testing.T) {
	Convey("Parsing alert notification from settings", t, func() {
		Convey("empty settings should cause error", func() {
			const json = `{}`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)
			model := &models.AlertNotification{
				Name:     "sls_testing",
				Type:     "alibaba-cloud-sls",
				Settings: settingsJSON,
			}

			_, err = NewAlibabaCloudSLSNotifier(model)
			So(err, ShouldNotBeNil)
		})

		Convey("empty url should cause error", func() {
			const json = `{ "url": "" }`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)
			model := &models.AlertNotification{
				Name:     "sls_testing",
				Type:     "alibaba-cloud-sls",
				Settings: settingsJSON,
			}

			_, err = NewAlibabaCloudSLSNotifier(model)
			So(err, ShouldNotBeNil)
		})

		Convey("defaultSeverity should have default value", func() {
			const json = `{ "url": "https://12345.com"}`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)
			model := &models.AlertNotification{
				Name:     "sls_testing",
				Type:     "alibaba-cloud-sls",
				Settings: settingsJSON,
			}

			not, err := NewAlibabaCloudSLSNotifier(model)
			So(err, ShouldBeNil)

			slsNotifier := not.(*AlibabaCloudSLSNotifier)
			So(slsNotifier.URL, ShouldEqual, "https://12345.com")
			So(slsNotifier.DefaultSeverity, ShouldEqual, "Medium")
		})

		Convey("defaultSeverity should override default value", func() {
			const json = `{ "url": "https://12345.com", "defaultSeverity": "Critical" }`

			settingsJSON, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)
			model := &models.AlertNotification{
				Name:     "sls_testing",
				Type:     "alibaba-cloud-sls",
				Settings: settingsJSON,
			}

			not, err := NewAlibabaCloudSLSNotifier(model)
			So(err, ShouldBeNil)

			slsNotifier := not.(*AlibabaCloudSLSNotifier)
			So(slsNotifier.URL, ShouldEqual, "https://12345.com")
			So(slsNotifier.DefaultSeverity, ShouldEqual, "Critical")
		})
	})
}
