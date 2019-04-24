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
				readLDAPConfig = func() (bool, *LDAP.Config) {
					config := &LDAP.Config{
						Servers: []*LDAP.LdapServerConf{},
					}

					return setting.LdapEnabled, config
				}

				enabled, err := loginUsingLdap(sc.loginUserQuery)

				Convey("it should return true", func() {
					So(enabled, ShouldBeTrue)
				})

				Convey("it should return invalid credentials error", func() {
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

func mockLdapAuthenticator(valid bool) *mockLdapAuther {
	mock := &mockLdapAuther{
		validLogin: valid,
	}

	newLDAP = func(server *LDAP.LdapServerConf) LDAP.ILdapAuther {
		return mock
	}

	return mock
}

type mockLdapAuther struct {
	validLogin  bool
	loginCalled bool
}

func (auth *mockLdapAuther) Login(query *m.LoginUserQuery) error {
	auth.loginCalled = true

	if !auth.validLogin {
		return errTest
	}

	return nil
}

func (auth *mockLdapAuther) SyncUser(query *m.LoginUserQuery) error {
	return nil
}

func (auth *mockLdapAuther) GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *LDAP.LdapUserInfo) (*m.User, error) {
	return nil, nil
}

type ldapLoginScenarioContext struct {
	loginUserQuery        *m.LoginUserQuery
	ldapAuthenticatorMock *mockLdapAuther
}

type ldapLoginScenarioFunc func(c *ldapLoginScenarioContext)

func ldapLoginScenario(desc string, fn ldapLoginScenarioFunc) {
	Convey(desc, func() {
		mock := &mockLdapAuther{}

		sc := &ldapLoginScenarioContext{
			loginUserQuery: &m.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
			ldapAuthenticatorMock: mock,
		}

		readLDAPConfig = func() (bool, *LDAP.Config) {
			config := &LDAP.Config{
				Servers: []*LDAP.LdapServerConf{
					&LDAP.LdapServerConf{
						Host: "",
					},
				},
			}

			return setting.LdapEnabled, config
		}

		newLDAP = func(server *LDAP.LdapServerConf) LDAP.ILdapAuther {
			return mock
		}

		defer func() {
			newLDAP = LDAP.New
			readLDAPConfig = LDAP.ReadConfig
		}()

		fn(sc)
	})
}

func (sc *ldapLoginScenarioContext) withLoginResult(valid bool) {
	sc.ldapAuthenticatorMock = mockLdapAuthenticator(valid)
}
