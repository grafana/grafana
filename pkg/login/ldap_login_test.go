package login

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
)

var errTest = errors.New("Test error")

func TestLDAPLogin(t *testing.T) {
	Convey("Login using ldap", t, func() {
		Convey("Given ldap enabled and no server configured", func() {
			setting.LDAPEnabled = true

			LDAPLoginScenario("When login", func(sc *LDAPLoginScenarioContext) {
				sc.withLoginResult(false)
				getLDAPConfig = func() (*ldap.Config, error) {
					config := &ldap.Config{
						Servers: []*ldap.ServerConfig{},
					}

					return config, nil
				}

				enabled, err := loginUsingLDAP(sc.loginUserQuery)

				Convey("it should return true", func() {
					So(enabled, ShouldBeTrue)
				})

				Convey("it should return no LDAP servers error", func() {
					So(err, ShouldEqual, errTest)
				})

				Convey("it should not call ldap login", func() {
					So(sc.LDAPAuthenticatorMock.loginCalled, ShouldBeTrue)
				})
			})
		})

		Convey("Given ldap disabled", func() {
			setting.LDAPEnabled = false

			LDAPLoginScenario("When login", func(sc *LDAPLoginScenarioContext) {
				sc.withLoginResult(false)
				enabled, err := loginUsingLDAP(&models.LoginUserQuery{
					Username: "user",
					Password: "pwd",
				})

				Convey("it should return false", func() {
					So(enabled, ShouldBeFalse)
				})

				Convey("it should not return error", func() {
					So(err, ShouldBeNil)
				})

				Convey("it should not call ldap login", func() {
					So(sc.LDAPAuthenticatorMock.loginCalled, ShouldBeFalse)
				})
			})
		})
	})
}

type mockAuth struct {
	validLogin  bool
	loginCalled bool
}

func (auth *mockAuth) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo,
	error,
) {
	auth.loginCalled = true

	if !auth.validLogin {
		return nil, errTest
	}

	return nil, nil
}

func (auth *mockAuth) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	return nil, nil
}

func (auth *mockAuth) User(login string) (
	*models.ExternalUserInfo,
	error,
) {
	return nil, nil
}

func (auth *mockAuth) Add(dn string, values map[string][]string) error {
	return nil
}

func (auth *mockAuth) Remove(dn string) error {
	return nil
}

func mockLDAPAuthenticator(valid bool) *mockAuth {
	mock := &mockAuth{
		validLogin: valid,
	}

	newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
		return mock
	}

	return mock
}

type LDAPLoginScenarioContext struct {
	loginUserQuery        *models.LoginUserQuery
	LDAPAuthenticatorMock *mockAuth
}

type LDAPLoginScenarioFunc func(c *LDAPLoginScenarioContext)

func LDAPLoginScenario(desc string, fn LDAPLoginScenarioFunc) {
	Convey(desc, func() {
		mock := &mockAuth{}

		sc := &LDAPLoginScenarioContext{
			loginUserQuery: &models.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
			LDAPAuthenticatorMock: mock,
		}

		getLDAPConfig = func() (*ldap.Config, error) {
			config := &ldap.Config{
				Servers: []*ldap.ServerConfig{
					{
						Host: "",
					},
				},
			}

			return config, nil
		}

		newLDAP = func(server []*ldap.ServerConfig) multildap.IMultiLDAP {
			return mock
		}

		defer func() {
			newLDAP = multildap.New
			getLDAPConfig = multildap.GetConfig
		}()

		fn(sc)
	})
}

func (sc *LDAPLoginScenarioContext) withLoginResult(valid bool) {
	sc.LDAPAuthenticatorMock = mockLDAPAuthenticator(valid)
}
