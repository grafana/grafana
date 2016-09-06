package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestBaseNotifier(t *testing.T) {
	Convey("Parsing base notification severity", t, func() {

		Convey("matches", func() {
			json := `
				{
					"severityFilter": "critical"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			not := NewNotifierBase("ops", "email", settingsJSON)
			So(not.MatchSeverity(m.AlertSeverityCritical), ShouldBeTrue)
		})

		Convey("does not match", func() {
			json := `
				{
					"severityFilter": "critical"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			not := NewNotifierBase("ops", "email", settingsJSON)
			So(not.MatchSeverity(m.AlertSeverityWarning), ShouldBeFalse)
		})
	})
}
