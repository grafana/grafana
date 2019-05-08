package login

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
	LDAP "github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/setting"
)

var errTest = errors.New("Test error")

func TestLdapLogin(t *testing.T) {
	Convey("Login using ldap", t, func() {
		Convey("Given ldap enabled and no server configured", func() {
			setting.LdapEnabled = true

			ldapLoginScenario("When login", func(sc *ldapLoginScenarioContext) {
				sc.withLoginResult(false)
				getLDAPConfig = func() (*LDAP.Config, error) {
					config := &LDAP.Config{
						Servers: []*LDAP.ServerConfig{},
					}

					return config, nil
				}

				enabled, err := loginUsingLdap(sc.loginUserQuery)

				Convey("it should return true", func() {
					So(enabled, ShouldBeTrue)
				})

				Convey("it should return no LDAP servers error", func() {
					So(err, ShouldEqual, ErrNoLDAPServers)
				})

				Convey("it should not call ldap login", func() {
					So(sc.ldapAuthenticatorMock.loginCalled, ShouldBeFalse)
				})
			})
		})

		Convey("Given ldap disabled", func() {
			setting.LdapEnabled = false

			ldapLoginScenario("When login", func(sc *ldapLoginScenarioContext) {
				sc.withLoginResult(false)
				enabled, err := loginUsingLdap(&m.LoginUserQuery{
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
					So(sc.ldapAuthenticatorMock.loginCalled, ShouldBeFalse)
				})
			})
		})
	})
}

func mockLdapAuthenticator(valid bool) *mockAuth {
	mock := &mockAuth{
		validLogin: valid,
	}

	newLDAP = func(server *LDAP.ServerConfig) LDAP.IAuth {
		return mock
	}

	return mock
}

type mockAuth struct {
	validLogin  bool
	loginCalled bool
}

func (auth *mockAuth) Login(query *m.LoginUserQuery) error {
	auth.loginCalled = true

	if !auth.validLogin {
		return errTest
	}

	return nil
}

func (auth *mockAuth) Users() ([]*LDAP.UserInfo, error) {
	return nil, nil
}

func (auth *mockAuth) SyncUser(query *m.LoginUserQuery) error {
	return nil
}

func (auth *mockAuth) GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *LDAP.UserInfo) (*m.User, error) {
	return nil, nil
}

type ldapLoginScenarioContext struct {
	loginUserQuery        *m.LoginUserQuery
	ldapAuthenticatorMock *mockAuth
}

type ldapLoginScenarioFunc func(c *ldapLoginScenarioContext)

func ldapLoginScenario(desc string, fn ldapLoginScenarioFunc) {
	Convey(desc, func() {
		mock := &mockAuth{}

		sc := &ldapLoginScenarioContext{
			loginUserQuery: &m.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
			ldapAuthenticatorMock: mock,
		}

		getLDAPConfig = func() (*LDAP.Config, error) {
			config := &LDAP.Config{
				Servers: []*LDAP.ServerConfig{
					{
						Host: "",
					},
				},
			}

			return config, nil
		}

		newLDAP = func(server *LDAP.ServerConfig) LDAP.IAuth {
			return mock
		}

		defer func() {
			newLDAP = LDAP.New
			getLDAPConfig = LDAP.GetConfig
		}()

		fn(sc)
	})
}

func (sc *ldapLoginScenarioContext) withLoginResult(valid bool) {
	sc.ldapAuthenticatorMock = mockLdapAuthenticator(valid)
}
