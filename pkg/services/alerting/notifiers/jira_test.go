package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestJiraNotifier(t *testing.T) {
	Convey("Jira notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "jira notifier",
					Type:     "jira",
					Settings: settingsJSON,
				}

				_, err := NewJiraNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
					"url": "https://jira.void.com",
					"project": "test",
					"type": "Bug",
					"priority": "High",
					"username": "smo",
					"token": "1234"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "jira notifier",
					Type:     "jira",
					Settings: settingsJSON,
				}

				not, err := NewJiraNotifier(model)
				So(err, ShouldBeNil)
				jiranotifier := not.(*JiraNotifier)

				So(err, ShouldBeNil)
				So(jiranotifier.Name, ShouldEqual, "jira notifier")
				So(jiranotifier.Type, ShouldEqual, "Bug")
				So(jiranotifier.Token, ShouldEqual, "1234")
				So(jiranotifier.Username, ShouldEqual, "smo")
				So(jiranotifier.Project, ShouldEqual, "test")
				So(jiranotifier.Priority, ShouldEqual, "High")
			})
		})
	})
}
