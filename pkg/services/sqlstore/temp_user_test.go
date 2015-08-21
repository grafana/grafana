package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestTempUserCommandsAndQueries(t *testing.T) {

	Convey("Testing Temp User commands & queries", t, func() {
		InitTestDB(t)

		Convey("Given saved api key", func() {
			cmd := m.CreateTempUserCommand{
				OrgId:  2256,
				Name:   "hello",
				Code:   "asd",
				Email:  "e@as.co",
				Status: m.TmpUserInvitePending,
			}
			err := CreateTempUser(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get temp users by org id", func() {
				query := m.GetTempUsersForOrgQuery{OrgId: 2256, Status: m.TmpUserInvitePending}
				err = GetTempUsersForOrg(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})

			Convey("Should be able to get temp users by code", func() {
				query := m.GetTempUserByCodeQuery{Code: "asd"}
				err = GetTempUserByCode(&query)

				So(err, ShouldBeNil)
				So(query.Result.Name, ShouldEqual, "hello")
			})

			Convey("Should be able update status", func() {
				cmd2 := m.UpdateTempUserStatusCommand{Code: "asd", Status: m.TmpUserRevoked}
				err := UpdateTempUserStatus(&cmd2)
				So(err, ShouldBeNil)
			})

		})
	})
}
