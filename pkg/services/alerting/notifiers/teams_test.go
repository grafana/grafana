package notifiers

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTeamsNotifier(t *testing.T) {
	Convey("Teams notifier tests", t, func() {
		store := database.ProvideSecretsStore(sqlstore.InitTestDB(t))
		secretsService := secretsManager.SetupTestService(t, store)
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "teams",
					Settings: settingsJSON,
				}

				_, err := NewTeamsNotifier(model, secretsService.GetDecryptedValue)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "teams",
					Settings: settingsJSON,
				}

				not, err := NewTeamsNotifier(model, secretsService.GetDecryptedValue)
				teamsNotifier := not.(*TeamsNotifier)

				So(err, ShouldBeNil)
				So(teamsNotifier.Name, ShouldEqual, "ops")
				So(teamsNotifier.Type, ShouldEqual, "teams")
				So(teamsNotifier.URL, ShouldEqual, "http://google.com")
			})

			Convey("from settings with Recipient and Mention", func() {
				json := `
				{
          "url": "http://google.com"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "ops",
					Type:     "teams",
					Settings: settingsJSON,
				}

				not, err := NewTeamsNotifier(model, secretsService.GetDecryptedValue)
				teamsNotifier := not.(*TeamsNotifier)

				So(err, ShouldBeNil)
				So(teamsNotifier.Name, ShouldEqual, "ops")
				So(teamsNotifier.Type, ShouldEqual, "teams")
				So(teamsNotifier.URL, ShouldEqual, "http://google.com")
			})
		})
	})
}
