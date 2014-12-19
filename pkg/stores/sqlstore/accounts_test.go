package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func TestAccountDataAccess(t *testing.T) {

	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Given two saved accounts", func() {
			ac1 := m.Account{
				Login: "ac1",
				Email: "ac1@test.com",
				Name:  "ac1_name",
			}
			ac2 := m.Account{
				Login: "ac2",
				Email: "ac2@test.com",
				Name:  "ac2_name",
			}

			err := SaveAccount(&ac1)
			err = SaveAccount(&ac2)
			So(err, ShouldBeNil)

			Convey("Should be able to read account info projection", func() {
				query := m.GetAccountInfoQuery{Id: ac1.Id}
				err = GetAccountInfo(&query)

				So(err, ShouldBeNil)
				So(query.Result.Name, ShouldEqual, "ac1_name")
			})

			Convey("Can add collaborator", func() {
				cmd := m.AddCollaboratorCommand{
					AccountId:    ac2.Id,
					ForAccountId: ac1.Id,
					Role:         m.ROLE_READ_WRITE,
				}

				err := AddCollaborator(&cmd)
				Convey("Saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Collaborator should be included in account info projection", func() {
					query := m.GetAccountInfoQuery{Id: ac1.Id}
					err = GetAccountInfo(&query)

					So(err, ShouldBeNil)
					So(query.Result.Collaborators[0].AccountId, ShouldEqual, ac2.Id)
					So(query.Result.Collaborators[0].Role, ShouldEqual, m.ROLE_READ_WRITE)
					So(query.Result.Collaborators[0].Email, ShouldEqual, "ac2@test.com")
				})
			})
		})
	})
}
