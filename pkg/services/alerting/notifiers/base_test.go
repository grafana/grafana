package notifiers

import . "github.com/smartystreets/goconvey/convey"

func TestBaseNotifier( /* t *testing.T */ ) {
	// Convey("Parsing base notification state", t, func() {
	//
	// 	Convey("matches", func() {
	// 		json := `
	// 			{
	// 				"states": "critical"
	// 			}`
	//
	// 		settingsJSON, _ := simplejson.NewJson([]byte(json))
	// 		not := NewNotifierBase("ops", "email", settingsJSON)
	// 		So(not.MatchSeverity(m.AlertSeverityCritical), ShouldBeTrue)
	// 	})
	//
	// 	Convey("does not match", func() {
	// 		json := `
	// 			{
	// 				"severityFilter": "critical"
	// 			}`
	//
	// 		settingsJSON, _ := simplejson.NewJson([]byte(json))
	// 		not := NewNotifierBase("ops", "email", settingsJSON)
	// 		So(not.MatchSeverity(m.AlertSeverityWarning), ShouldBeFalse)
	// 	})
	// })
}
