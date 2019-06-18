package multildap

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

func TestMultiLDAP(t *testing.T) {
	Convey("Multildap", t, func() {
		Convey("Login()", func() {
			Convey("Should return error for absent config list", func() {
				setup()

				multi := New([]*ldap.ServerConfig{})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(err, ShouldBeError)
				So(err, ShouldEqual, ErrNoLDAPServers)

				teardown()
			})

			Convey("Should return a dial error", func() {
				mock := setup()

				expected := errors.New("Dial error")
				mock.dialErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})

				_, err := multi.Login(&models.LoginUserQuery{})

				So(err, ShouldBeError)
				So(err, ShouldEqual, expected)

				teardown()
			})

			Convey("Should call underlying LDAP methods", func() {
				mock := setup()

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.loginCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldEqual, ErrInvalidCredentials)

				teardown()
			})

			Convey("Should get login result", func() {
				mock := setup()

				mock.loginReturn = &models.ExternalUserInfo{
					Login: "killa",
				}

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				result, err := multi.Login(&models.LoginUserQuery{})

				So(mock.dialCalledTimes, ShouldEqual, 1)
				So(mock.loginCalledTimes, ShouldEqual, 1)
				So(mock.closeCalledTimes, ShouldEqual, 1)

				So(result.Login, ShouldEqual, "killa")
				So(err, ShouldBeNil)

				teardown()
			})

			Convey("Should still call a second error for invalid cred error", func() {
				mock := setup()

				mock.loginErrReturn = ErrInvalidCredentials

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.loginCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldEqual, ErrInvalidCredentials)

				teardown()
			})

			Convey("Should return unknown error", func() {
				mock := setup()

				expected := errors.New("Something unknown")
				mock.loginErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(mock.dialCalledTimes, ShouldEqual, 1)
				So(mock.loginCalledTimes, ShouldEqual, 1)
				So(mock.closeCalledTimes, ShouldEqual, 1)

				So(err, ShouldEqual, expected)

				teardown()
			})
		})

		Convey("User()", func() {
			Convey("Should return error for absent config list", func() {
				setup()

				multi := New([]*ldap.ServerConfig{})
				_, err := multi.User("test")

				So(err, ShouldBeError)
				So(err, ShouldEqual, ErrNoLDAPServers)

				teardown()
			})

			Convey("Should return a dial error", func() {
				mock := setup()

				expected := errors.New("Dial error")
				mock.dialErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})

				_, err := multi.User("test")

				So(err, ShouldBeError)
				So(err, ShouldEqual, expected)

				teardown()
			})

			Convey("Should call underlying LDAP methods", func() {
				mock := setup()

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.User("test")

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.usersCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldEqual, ErrDidNotFindUser)

				teardown()
			})

			Convey("Should return some error", func() {
				mock := setup()

				expected := errors.New("Killa Gorilla")
				mock.usersErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.User("test")

				So(mock.dialCalledTimes, ShouldEqual, 1)
				So(mock.usersCalledTimes, ShouldEqual, 1)
				So(mock.closeCalledTimes, ShouldEqual, 1)

				So(err, ShouldEqual, expected)

				teardown()
			})

			Convey("Should get only one user", func() {
				mock := setup()

				mock.usersFirstReturn = []*models.ExternalUserInfo{
					{
						Login: "one",
					},

					{
						Login: "two",
					},
				}

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				user, err := multi.User("test")

				So(mock.dialCalledTimes, ShouldEqual, 1)
				So(mock.usersCalledTimes, ShouldEqual, 1)
				So(mock.closeCalledTimes, ShouldEqual, 1)

				So(err, ShouldBeNil)
				So(user.Login, ShouldEqual, "one")

				teardown()
			})
		})

		Convey("Users()", func() {
			Convey("Should return error for absent config list", func() {
				setup()

				multi := New([]*ldap.ServerConfig{})
				_, err := multi.Users([]string{"test"})

				So(err, ShouldBeError)
				So(err, ShouldEqual, ErrNoLDAPServers)

				teardown()
			})

			Convey("Should return a dial error", func() {
				mock := setup()

				expected := errors.New("Dial error")
				mock.dialErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})

				_, err := multi.Users([]string{"test"})

				So(err, ShouldBeError)
				So(err, ShouldEqual, expected)

				teardown()
			})

			Convey("Should call underlying LDAP methods", func() {
				mock := setup()

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Users([]string{"test"})

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.usersCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldBeNil)

				teardown()
			})

			Convey("Should return some error", func() {
				mock := setup()

				expected := errors.New("Killa Gorilla")
				mock.usersErrReturn = expected

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Users([]string{"test"})

				So(mock.dialCalledTimes, ShouldEqual, 1)
				So(mock.usersCalledTimes, ShouldEqual, 1)
				So(mock.closeCalledTimes, ShouldEqual, 1)

				So(err, ShouldEqual, expected)

				teardown()
			})

			Convey("Should get users", func() {
				mock := setup()

				mock.usersFirstReturn = []*models.ExternalUserInfo{
					{
						Login: "one",
					},

					{
						Login: "two",
					},
				}

				mock.usersRestReturn = []*models.ExternalUserInfo{
					{
						Login: "three",
					},
				}

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				users, err := multi.Users([]string{"test"})

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.usersCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldBeNil)
				So(users[0].Login, ShouldEqual, "one")
				So(users[1].Login, ShouldEqual, "two")
				So(users[2].Login, ShouldEqual, "three")

				teardown()
			})
		})
	})
}
