package alerting

// func TestAlertNotificationExtraction(t *testing.T) {
// 	Convey("Notifier tests", t, func() {
// 		Convey("rules for sending notifications", func() {
// 			dummieNotifier := NotifierImpl{}
//
// 			result := &AlertResult{
// 				State: alertstates.Critical,
// 			}
//
// 			notifier := &Notification{
// 				Name:         "Test Notifier",
// 				Type:         "TestType",
// 				SendCritical: true,
// 				SendWarning:  true,
// 			}
//
// 			Convey("Should send notification", func() {
// 				So(dummieNotifier.ShouldDispath(result, notifier), ShouldBeTrue)
// 			})
//
// 			Convey("warn:false and state:warn should not send", func() {
// 				result.State = alertstates.Warn
// 				notifier.SendWarning = false
// 				So(dummieNotifier.ShouldDispath(result, notifier), ShouldBeFalse)
// 			})
// 		})
//
// 		Convey("Parsing alert notification from settings", func() {
// 			Convey("Parsing email", func() {
// 				Convey("empty settings should return error", func() {
// 					json := `{ }`
//
// 					settingsJSON, _ := simplejson.NewJson([]byte(json))
// 					model := &m.AlertNotification{
// 						Name:     "ops",
// 						Type:     "email",
// 						Settings: settingsJSON,
// 					}
//
// 					_, err := NewNotificationFromDBModel(model)
// 					So(err, ShouldNotBeNil)
// 				})
//
// 				Convey("from settings", func() {
// 					json := `
// 				{
// 					"to": "ops@grafana.org"
// 				}`
//
// 					settingsJSON, _ := simplejson.NewJson([]byte(json))
// 					model := &m.AlertNotification{
// 						Name:     "ops",
// 						Type:     "email",
// 						Settings: settingsJSON,
// 					}
//
// 					not, err := NewNotificationFromDBModel(model)
//
// 					So(err, ShouldBeNil)
// 					So(not.Name, ShouldEqual, "ops")
// 					So(not.Type, ShouldEqual, "email")
// 					So(reflect.TypeOf(not.Notifierr).Elem().String(), ShouldEqual, "alerting.EmailNotifier")
//
// 					email := not.Notifierr.(*EmailNotifier)
// 					So(email.To, ShouldEqual, "ops@grafana.org")
// 				})
// 			})
//
// 			Convey("Parsing webhook", func() {
// 				Convey("empty settings should return error", func() {
// 					json := `{ }`
//
// 					settingsJSON, _ := simplejson.NewJson([]byte(json))
// 					model := &m.AlertNotification{
// 						Name:     "ops",
// 						Type:     "webhook",
// 						Settings: settingsJSON,
// 					}
//
// 					_, err := NewNotificationFromDBModel(model)
// 					So(err, ShouldNotBeNil)
// 				})
//
// 				Convey("from settings", func() {
// 					json := `
// 				{
// 					"url": "http://localhost:3000",
// 					"username": "username",
// 					"password": "password"
// 				}`
//
// 					settingsJSON, _ := simplejson.NewJson([]byte(json))
// 					model := &m.AlertNotification{
// 						Name:     "slack",
// 						Type:     "webhook",
// 						Settings: settingsJSON,
// 					}
//
// 					not, err := NewNotificationFromDBModel(model)
//
// 					So(err, ShouldBeNil)
// 					So(not.Name, ShouldEqual, "slack")
// 					So(not.Type, ShouldEqual, "webhook")
// 					So(reflect.TypeOf(not.Notifierr).Elem().String(), ShouldEqual, "alerting.WebhookNotifier")
//
// 					webhook := not.Notifierr.(*WebhookNotifier)
// 					So(webhook.Url, ShouldEqual, "http://localhost:3000")
// 				})
// 			})
// 		})
// 	})
// }
