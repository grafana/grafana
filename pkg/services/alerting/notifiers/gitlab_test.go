package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestGitLabNotifier(t *testing.T) {
	Convey("GitLab notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "gitlab_testing",
					Type:     "gitlab",
					Settings: settingsJSON,
				}

				_, err := NewGitLabNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("settings should trigger incident", func() {
				json := `
				{
          "apiUrl": "https://gitlab.com/namespace/project/alerts/notify/grafana/abc123.json",
          "authKey": "c54457f9bd586b68a5e48c0a5a2a1b1f",
          "autoResolve": true
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "gitlab_testing",
					Type:     "gitlab",
					Settings: settingsJSON,
				}

				not, err := NewGitLabNotifier(model)
				gitlabNotifier := not.(*GitLabNotifier)

				So(err, ShouldBeNil)
				So(gitlabNotifier.Name, ShouldEqual, "gitlab_testing")
				So(gitlabNotifier.Type, ShouldEqual, "gitlab")
				So(gitlabNotifier.AuthKey, ShouldEqual, "c54457f9bd586b68a5e48c0a5a2a1b1f")
				So(gitlabNotifier.APIUrl, ShouldEqual, "https://gitlab.com/namespace/project/alerts/notify/grafana/abc123.json")
				So(gitlabNotifier.AutoResolve, ShouldEqual, true)
			})
		})
	})
}