package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPreferencesDataAccess(t *testing.T) {
	Convey("Testing preferences data access", t, func() {
		InitTestDB(t)

		Convey("GetPreferencesWithDefaults with no saved preferences should return defaults", func() {
			query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
			err := GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.Theme, ShouldEqual, setting.DefaultTheme)
			So(query.Result.Timezone, ShouldEqual, "browser")
			So(query.Result.HomeDashboardId, ShouldEqual, 0)
		})

		Convey("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 1}}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 4)
		})

		Convey("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 2}}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 1)
		})

		Convey("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{
				User: &models.SignedInUser{OrgId: 1, Teams: []int64{2, 3}},
			}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 3)
		})

		Convey("GetPreferencesWithDefaults with saved org and other teams home dashboard should return org home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1}}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 1)
		})

		Convey("GetPreferencesWithDefaults with saved org, teams and user home dashboard should return user home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{
				User: &models.SignedInUser{OrgId: 1, UserId: 1, Teams: []int64{2, 3}},
			}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 4)
		})

		Convey("GetPreferencesWithDefaults with saved org, other teams and user home dashboard should return org home dashboard", func() {
			err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
			So(err, ShouldBeNil)
			err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
			So(err, ShouldBeNil)

			query := &models.GetPreferencesWithDefaultsQuery{
				User: &models.SignedInUser{OrgId: 1, UserId: 2},
			}
			err = GetPreferencesWithDefaults(query)
			So(err, ShouldBeNil)
			So(query.Result.HomeDashboardId, ShouldEqual, 1)
		})
	})
}
