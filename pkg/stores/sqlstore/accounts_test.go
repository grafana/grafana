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
			ac1cmd := m.CreateAccountCommand{Login: "ac1", Email: "ac1@test.com"}
			ac2cmd := m.CreateAccountCommand{Login: "ac2", Email: "ac2@test.com"}

			err := CreateAccount(&ac1cmd)
			err = CreateAccount(&ac2cmd)
			So(err, ShouldBeNil)

			ac1 := ac1cmd.Result
			ac2 := ac2cmd.Result

			Convey("Should be able to read account info projection", func() {
				query := m.GetAccountInfoQuery{Id: ac1.Id}
				err = GetAccountInfo(&query)

				So(err, ShouldBeNil)
				So(query.Result.Email, ShouldEqual, "ac1@test.com")
			})

			Convey("Can add collaborator", func() {
				cmd := m.AddCollaboratorCommand{
					AccountId:      ac1.Id,
					CollaboratorId: ac2.Id,
					Role:           m.ROLE_READ_WRITE,
				}

				err := AddCollaborator(&cmd)
				Convey("Saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Collaborator should be included in account info projection", func() {
					query := m.GetAccountInfoQuery{Id: ac1.Id}
					err = GetAccountInfo(&query)

					So(err, ShouldBeNil)
					So(query.Result.Collaborators[0].CollaboratorId, ShouldEqual, ac2.Id)
					So(query.Result.Collaborators[0].Role, ShouldEqual, m.ROLE_READ_WRITE)
					So(query.Result.Collaborators[0].Email, ShouldEqual, "ac2@test.com")
				})

				Convey("Can get other accounts", func() {
					query := m.GetOtherAccountsQuery{AccountId: ac2.Id}
					err := GetOtherAccounts(&query)

					So(err, ShouldBeNil)
					So(query.Result[0].Email, ShouldEqual, "ac1@test.com")
				})

				Convey("Can set using account", func() {
					cmd := m.SetUsingAccountCommand{AccountId: ac2.Id, UsingAccountId: ac1.Id}
					err := SetUsingAccount(&cmd)
					So(err, ShouldBeNil)
				})
			})
		})
	})
}
