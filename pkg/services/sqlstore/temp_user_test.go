package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTempUserCommandsAndQueries(t *testing.T) {
	Convey("Testing Temp User commands & queries", t, func() {
		InitTestDB(t)

		Convey("Given saved api key", func() {
			cmd := models.CreateTempUserCommand{
				OrgId:  2256,
				Name:   "hello",
				Code:   "asd",
				Email:  "e@as.co",
				Status: models.TmpUserInvitePending,
			}
			err := CreateTempUser(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get temp users by org id", func() {
				query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})

			Convey("Should be able to get temp users by email", func() {
				query := models.GetTempUsersQuery{Email: "e@as.co", Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})

			Convey("Should be able to get temp users by code", func() {
				query := models.GetTempUserByCodeQuery{Code: "asd"}
				err = GetTempUserByCode(&query)

				So(err, ShouldBeNil)
				So(query.Result.Name, ShouldEqual, "hello")
			})

			Convey("Should be able update status", func() {
				cmd2 := models.UpdateTempUserStatusCommand{Code: "asd", Status: models.TmpUserRevoked}
				err := UpdateTempUserStatus(&cmd2)
				So(err, ShouldBeNil)
			})

			Convey("Should be able update email sent and email sent on", func() {
				cmd3 := models.UpdateTempUserWithEmailSentCommand{Code: cmd.Result.Code}
				err := UpdateTempUserWithEmailSent(&cmd3)
				So(err, ShouldBeNil)

				query := models.GetTempUsersQuery{OrgId: 2256, Status: models.TmpUserInvitePending}
				err = GetTempUsersQuery(&query)

				So(err, ShouldBeNil)
				So(query.Result[0].EmailSent, ShouldBeTrue)
				So(query.Result[0].EmailSentOn, ShouldHappenOnOrAfter, (query.Result[0].Created))
			})
		})
	})
}
