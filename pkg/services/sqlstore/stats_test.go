package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestStatsDataAccess(t *testing.T) {
	Convey("Testing Stats Data Access", t, func() {
		InitTestDB(t)

		Convey("Get system stats should not results in error", func() {
			populateDB()

			query := models.GetSystemStatsQuery{}
			err := GetSystemStats(&query)
			So(err, ShouldBeNil)
			So(query.Result.Users, ShouldEqual, 3)
			So(query.Result.Editors, ShouldEqual, 1)
			So(query.Result.Viewers, ShouldEqual, 1)
			So(query.Result.Admins, ShouldEqual, 3)
		})

		Convey("Get system user count stats should not results in error", func() {
			query := models.GetSystemUserCountStatsQuery{}
			err := GetSystemUserCountStats(context.Background(), &query)
			So(err, ShouldBeNil)
		})

		Convey("Get datasource stats should not results in error", func() {
			query := models.GetDataSourceStatsQuery{}
			err := GetDataSourceStats(&query)
			So(err, ShouldBeNil)
		})

		Convey("Get datasource access stats should not results in error", func() {
			query := models.GetDataSourceAccessStatsQuery{}
			err := GetDataSourceAccessStats(&query)
			So(err, ShouldBeNil)
		})

		Convey("Get alert notifier stats should not results in error", func() {
			query := models.GetAlertNotifierUsageStatsQuery{}
			err := GetAlertNotifiersUsageStats(context.Background(), &query)
			So(err, ShouldBeNil)
		})

		Convey("Get admin stats should not result in error", func() {
			query := models.GetAdminStatsQuery{}
			err := GetAdminStats(&query)
			So(err, ShouldBeNil)
		})
	})
}

func populateDB() {
	fmt.Println(">>> populateDB")
	users := make([]models.User, 3)
	for i := range users {
		cmd := &models.CreateUserCommand{
			Email:   fmt.Sprintf("usertest%v@test.com", i),
			Name:    fmt.Sprintf("user name %v", i),
			Login:   fmt.Sprintf("user_test_%v_login", i),
			OrgName: fmt.Sprintf("Org #%v", i),
		}
		err := CreateUser(context.Background(), cmd)
		So(err, ShouldBeNil)
		users[i] = cmd.Result
	}

	getOrgByIdQuery := &models.GetOrgByIdQuery{Id: users[0].OrgId}
	err := GetOrgById(getOrgByIdQuery)
	So(err, ShouldBeNil)
	org := getOrgByIdQuery.Result

	cmd := &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[1].Id,
		Role:   models.ROLE_EDITOR,
	}
	err = AddOrgUser(cmd)
	So(err, ShouldBeNil)

	cmd = &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[2].Id,
		Role:   models.ROLE_VIEWER,
	}
	err = AddOrgUser(cmd)
	So(err, ShouldBeNil)
}
