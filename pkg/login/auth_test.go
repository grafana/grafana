package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAuthenticateUser(t *testing.T) {
	Convey("Given Ldap disabled", t, func() {
		setting.LdapEnabled = false

		Convey("When non-existing user authenticates", func() {
			bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
				return m.ErrUserNotFound
			})

			err := AuthenticateUser(&LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			})

			Convey("it should result in ErrInvalidCredentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})
		})

		Convey("When user authenticates with wrong credentials", func() {
			bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
				query.Result = &m.User{
					Password: "pwd",
					Salt:     "salt",
				}
				return nil
			})

			Convey("for the 4th subsequent time", func() {
				bus.AddHandler("test", func(query *m.GetUserLoginAttemptCountQuery) error {
					query.Result = 4
					return nil
				})

				query := LoginUserQuery{
					Username:  "user",
					Password:  "pwd",
					IpAddress: "192.168.1.1:56433",
				}

				var createLoginAttemptCmd *m.CreateLoginAttemptCommand

				bus.AddHandler("test", func(cmd *m.CreateLoginAttemptCommand) error {
					createLoginAttemptCmd = cmd
					return nil
				})

				err := AuthenticateUser(&query)

				Convey("it should result in ErrInvalidCredentials error", func() {
					So(err, ShouldEqual, ErrInvalidCredentials)
				})

				Convey("it should create a login attempt", func() {
					So(createLoginAttemptCmd, ShouldNotBeNil)
					So(createLoginAttemptCmd.Username, ShouldEqual, query.Username)
					So(createLoginAttemptCmd.IpAddress, ShouldEqual, query.IpAddress)
				})
			})

			Convey("for the 5th subsequent time", func() {
				bus.AddHandler("test", func(query *m.GetUserLoginAttemptCountQuery) error {
					query.Result = 5
					return nil
				})

				err := AuthenticateUser(&LoginUserQuery{
					Username:  "user",
					Password:  "pwd",
					IpAddress: "192.168.1.1:56433",
				})

				Convey("it should result in TooManyLoginAttempts error", func() {
					So(err, ShouldEqual, ErrTooManyLoginAttempts)
				})
			})
		})
	})
}
