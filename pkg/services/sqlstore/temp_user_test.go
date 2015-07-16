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
				OrgId:    2256,
				Name:     "hello",
				Email:    "e@as.co",
				IsInvite: true,
			}
			err := CreateTempUser(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get temp users by org id", func() {
				query := m.GetTempUsersForOrgQuery{OrgId: 2256}
				err = GetTempUsersForOrg(&query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})

		})
	})
}
