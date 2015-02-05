package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

func TestAccountDataAccess(t *testing.T) {

	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Given single account mode", func() {
			setting.SingleAccountMode = true
			setting.DefaultAccountName = "test"
			setting.DefaultAccountRole = "Viewer"

			Convey("Users should be added to default account", func() {
				ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := m.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				err := CreateUser(&ac1cmd)
				So(err, ShouldBeNil)
				err = CreateUser(&ac2cmd)
				So(err, ShouldBeNil)

				q1 := m.GetUserAccountsQuery{UserId: ac1cmd.Result.Id}
				q2 := m.GetUserAccountsQuery{UserId: ac2cmd.Result.Id}
				GetUserAccounts(&q1)
				GetUserAccounts(&q2)

				So(q1.Result[0].AccountId, ShouldEqual, q2.Result[0].AccountId)
				So(q1.Result[0].Role, ShouldEqual, "Viewer")
			})
		})

		Convey("Given two saved users", func() {
			setting.SingleAccountMode = false

			setting.DefaultAccountName = "test"
			ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := m.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}

			err := CreateUser(&ac1cmd)
			err = CreateUser(&ac2cmd)
			So(err, ShouldBeNil)

			ac1 := ac1cmd.Result
			ac2 := ac2cmd.Result

			Convey("Should be able to read user info projection", func() {
				query := m.GetUserInfoQuery{UserId: ac1.Id}
				err = GetUserInfo(&query)

				So(err, ShouldBeNil)
				So(query.Result.Email, ShouldEqual, "ac1@test.com")
				So(query.Result.Login, ShouldEqual, "ac1")
			})

			Convey("Can search users", func() {
				query := m.SearchUsersQuery{Query: ""}
				err := SearchUsers(&query)

				So(err, ShouldBeNil)
				So(query.Result[0].Email, ShouldEqual, "ac1@test.com")
				So(query.Result[1].Email, ShouldEqual, "ac2@test.com")
			})

			Convey("Given an added account user", func() {
				cmd := m.AddAccountUserCommand{
					AccountId: ac1.AccountId,
					UserId:    ac2.Id,
					Role:      m.ROLE_VIEWER,
				}

				err := AddAccountUser(&cmd)
				Convey("Should have been saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Can get logged in user projection", func() {
					query := m.GetSignedInUserQuery{UserId: ac2.Id}
					err := GetSignedInUser(&query)

					So(err, ShouldBeNil)
					So(query.Result.Email, ShouldEqual, "ac2@test.com")
					So(query.Result.AccountId, ShouldEqual, ac2.AccountId)
					So(query.Result.Name, ShouldEqual, "ac2 name")
					So(query.Result.Login, ShouldEqual, "ac2")
					So(query.Result.AccountRole, ShouldEqual, "Admin")
					So(query.Result.AccountName, ShouldEqual, "ac2@test.com")
					So(query.Result.IsGrafanaAdmin, ShouldBeTrue)
				})

				Convey("Can get user accounts", func() {
					query := m.GetUserAccountsQuery{UserId: ac2.Id}
					err := GetUserAccounts(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})

				Convey("Can get account users", func() {
					query := m.GetAccountUsersQuery{AccountId: ac1.AccountId}
					err := GetAccountUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Role, ShouldEqual, "Admin")
				})

				Convey("Can set using account", func() {
					cmd := m.SetUsingAccountCommand{UserId: ac2.Id, AccountId: ac1.Id}
					err := SetUsingAccount(&cmd)
					So(err, ShouldBeNil)

					Convey("SignedInUserQuery with a different account", func() {
						query := m.GetSignedInUserQuery{UserId: ac2.Id}
						err := GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.AccountId, ShouldEqual, ac1.Id)
						So(query.Result.Email, ShouldEqual, "ac2@test.com")
						So(query.Result.Name, ShouldEqual, "ac2 name")
						So(query.Result.Login, ShouldEqual, "ac2")
						So(query.Result.AccountName, ShouldEqual, "ac1@test.com")
						So(query.Result.AccountRole, ShouldEqual, "Viewer")
					})
				})

				Convey("Cannot delete last admin account user", func() {
					cmd := m.RemoveAccountUserCommand{AccountId: ac1.AccountId, UserId: ac1.Id}
					err := RemoveAccountUser(&cmd)
					So(err, ShouldEqual, m.ErrLastAccountAdmin)
				})
			})
		})
	})
}
