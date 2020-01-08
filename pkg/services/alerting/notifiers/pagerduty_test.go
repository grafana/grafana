package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/kinbiko/jsonassert"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPagerdutyNotifier(t *testing.T) {
	Convey("Pagerduty notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pageduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				_, err := NewPagerdutyNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("severity should override default", func() {
				json := `{ "integrationKey": "abcdefgh0123456789", "severity": "info", "tags": ["foo"]}`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.Severity, ShouldEqual, "info")
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})

			Convey("auto resolve and severity should have expected defaults", func() {
				json := `{ "integrationKey": "abcdefgh0123456789" }`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.Severity, ShouldEqual, "critical")
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
		  			"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				pagerdutyNotifier := not.(*PagerdutyNotifier)

				So(err, ShouldBeNil)
				So(pagerdutyNotifier.Name, ShouldEqual, "pagerduty_testing")
				So(pagerdutyNotifier.Type, ShouldEqual, "pagerduty")
				So(pagerdutyNotifier.Key, ShouldEqual, "abcdefgh0123456789")
				So(pagerdutyNotifier.AutoResolve, ShouldBeFalse)
			})

			Convey("should return properly formatted default v2 event payload", func() {
				json := `{
		  		"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(jerr, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				So(err, ShouldBeNil)

				pagerdutyNotifier := not.(*PagerdutyNotifier)
				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
				})

				evalContext.IsTestRun = true

				str, err := pagerdutyNotifier.buildEventPayload(evalContext)
				So(err, ShouldBeNil)

				ja := jsonassert.New(t)

				ja.Assertf(string(str), `{
					"client":"Grafana",
					"client_url":"",
					"dedup_key":"alertId-0",
					"event_action":"trigger",
					"links":[{"href":""}],
					"payload":{
						"component": "Grafana",
						"source" : "<<PRESENCE>>",
						"custom_details":{},
						"severity":"critical",
						"summary":"someRule - someMessage",
						"timestamp":"<<PRESENCE>>"
					},
					"routing_key":"abcdefgh0123456789"}`)
			})

			Convey("should return properly formatted v2 event payload when using override tags", func() {
				json := `{
		  		"integrationKey": "abcdefgh0123456789",
					"autoResolve": false
				}`

				settingsJSON, jerr := simplejson.NewJson([]byte(json))
				So(err, ShouldBeNil)

				model := &models.AlertNotification{
					Name:     "pagerduty_testing",
					Type:     "pagerduty",
					Settings: settingsJSON,
				}

				not, err := NewPagerdutyNotifier(model)
				So(err, ShouldBeNil)

				pagerdutyNotifier := not.(*PagerdutyNotifier)

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "keyOnly"},
						{Key: "group", Value: "aGroup"},
						{Key: "class", Value: "aClass"},
						{Key: "component", Value: "aComponent"},
					},
				})
				evalContext.ImagePublicURL = "http://somewhere.com/omg_dont_panic.png"
				evalContext.IsTestRun = true

				str, err := pagerdutyNotifier.buildEventPayload(evalContext)
				So(err, ShouldBeNil)

				ja := jsonassert.New(t)
				ja.Assertf(string(str), `{
					"client":"Grafana",
					"client_url":"",
					"dedup_key":"alertId-0",
					"event_action":"trigger",
					"links":[
						{
							"href":""
							}
					],
					"payload":{
						"source" : "<<PRESENCE>>",
						"component":"aComponent",
						"custom_details":{
							"group": "aGroup",
 							"class": "aClass",
 							"component": "aComponent",
							"keyOnly":""
						},
						"severity":"critical",
						"summary":"someRule - someMessage",
						"timestamp":"<<PRESENCE>>",
						"class" : "aClass",
						"group" : "aGroup"
					},
					"images": [{"src":"http://somewhere.com/omg_dont_panic.png"}],
					"routing_key":"abcdefgh0123456789"}`)
			})
		})
	})
}
