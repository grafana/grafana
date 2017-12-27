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

			Convey("for the 4th consecutive time", func() {
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

			Convey("for the 5th consecutive time", func() {
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

	Convey("Given Ldap enabled", t, func() {
		setting.LdapEnabled = true
		LdapCfg.Servers = append(LdapCfg.Servers,
			&LdapServerConf{
				Host: "",
			})

		Convey("When non-existing user authenticates", func() {
			ldapAuthenticatorMock := mockLdapAuthenticator(ErrInvalidCredentials)

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

			Convey("it should call Ldap authenticator", func() {
				So(ldapAuthenticatorMock.loginCalled, ShouldBeTrue)
			})
		})

		Convey("When user authenticates with wrong credentials and successful ldap authentication", func() {
			ldapAuthenticatorMock := mockLdapAuthenticator(nil)

			bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
				query.Result = &m.User{
					Password: "pwd",
					Salt:     "salt",
				}
				return nil
			})

			bus.AddHandler("test", func(query *m.GetUserLoginAttemptCountQuery) error {
				query.Result = 0
				return nil
			})

			var createLoginAttemptCmd *m.CreateLoginAttemptCommand

			bus.AddHandler("test", func(cmd *m.CreateLoginAttemptCommand) error {
				createLoginAttemptCmd = cmd
				return nil
			})

			query := LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			}

			err := AuthenticateUser(&query)

			Convey("it should not result in error", func() {
				So(err, ShouldBeNil)
			})

			Convey("it should call Ldap authenticator", func() {
				So(ldapAuthenticatorMock.loginCalled, ShouldBeTrue)
			})

			Convey("it should not create a login attempty", func() {
				So(createLoginAttemptCmd, ShouldBeNil)
			})
		})

		Convey("When user authenticates with wrong credentials and unsuccessful ldap authentication", func() {
			bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
				query.Result = &m.User{
					Password: "pwd",
					Salt:     "salt",
				}
				return nil
			})

			Convey("for the 4th consecutive time", func() {
				ldapAuthenticatorMock := mockLdapAuthenticator(ErrInvalidCredentials)
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

				Convey("it should call Ldap authenticator", func() {
					So(ldapAuthenticatorMock.loginCalled, ShouldBeTrue)
				})
			})

			Convey("for the 5th consecutive time", func() {
				ldapAuthenticatorMock := mockLdapAuthenticator(ErrInvalidCredentials)
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

				Convey("it should not call Ldap authenticator", func() {
					So(ldapAuthenticatorMock.loginCalled, ShouldBeFalse)
				})
			})
		})
	})
}

func mockLdapAuthenticator(loginError error) *mockLdapAuther {
	mock := &mockLdapAuther{
		LoginError: loginError,
	}

	NewLdapAuthenticator = func(server *LdapServerConf) ILdapAuther {
		return mock
	}

	return mock
}

type mockLdapAuther struct {
	LoginError  error
	loginCalled bool
}

func (a *mockLdapAuther) Login(query *LoginUserQuery) error {
	a.loginCalled = true
	return a.LoginError
}

func (a *mockLdapAuther) SyncSignedInUser(signedInUser *m.SignedInUser) error {
	return nil
}

func (a *mockLdapAuther) GetGrafanaUserFor(ldapUser *LdapUserInfo) (*m.User, error) {
	return nil, nil
}

func (a *mockLdapAuther) SyncOrgRoles(user *m.User, ldapUser *LdapUserInfo) error {
	return nil
}
