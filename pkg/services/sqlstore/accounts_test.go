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
			ac1cmd := m.CreateAccountCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := m.CreateAccountCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}

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
				So(query.Result.Login, ShouldEqual, "ac1")
			})

			Convey("Can search accounts", func() {
				query := m.SearchAccountsQuery{Query: ""}
				err := SearchAccounts(&query)

				So(err, ShouldBeNil)
				So(query.Result[0].Email, ShouldEqual, "ac1@test.com")
				So(query.Result[1].Email, ShouldEqual, "ac2@test.com")
			})

			Convey("Given an added collaborator", func() {
				cmd := m.AddCollaboratorCommand{
					AccountId:      ac1.Id,
					CollaboratorId: ac2.Id,
					Role:           m.ROLE_VIEWER,
				}

				err := AddCollaborator(&cmd)
				Convey("Should have been saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Can get logged in user projection", func() {
					query := m.GetSignedInUserQuery{AccountId: ac2.Id}
					err := GetSignedInUser(&query)

					So(err, ShouldBeNil)
					So(query.Result.AccountId, ShouldEqual, ac2.Id)
					So(query.Result.UserEmail, ShouldEqual, "ac2@test.com")
					So(query.Result.UserName, ShouldEqual, "ac2 name")
					So(query.Result.UserLogin, ShouldEqual, "ac2")
					So(query.Result.UserRole, ShouldEqual, "Owner")
					So(query.Result.UsingAccountName, ShouldEqual, "ac2 name")
					So(query.Result.UsingAccountId, ShouldEqual, ac2.Id)
					So(query.Result.IsGrafanaAdmin, ShouldBeTrue)
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

					Convey("Logged in user query should return correct using account info", func() {
						query := m.GetSignedInUserQuery{AccountId: ac2.Id}
						err := GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.AccountId, ShouldEqual, ac2.Id)
						So(query.Result.UserEmail, ShouldEqual, "ac2@test.com")
						So(query.Result.UserName, ShouldEqual, "ac2 name")
						So(query.Result.UserLogin, ShouldEqual, "ac2")
						So(query.Result.UsingAccountName, ShouldEqual, "ac1 name")
						So(query.Result.UsingAccountId, ShouldEqual, ac1.Id)
						So(query.Result.UserRole, ShouldEqual, "Viewer")
					})
				})
			})
		})
	})
}
