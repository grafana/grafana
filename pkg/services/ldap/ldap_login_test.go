package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLDAPLogin(t *testing.T) {
	Convey("Login()", t, func() {
		authScenario("When user is log in and updated", func(sc *scenarioContext) {
			// arrange
			mockConnection := &mockConnection{}

			auth := &Server{
				config: &ServerConfig{
					Host:       "",
					RootCACert: "",
					Groups: []*GroupToOrgRole{
						{GroupDN: "*", OrgRole: "Admin"},
					},
					Attr: AttributeMap{
						Username: "username",
						Surname:  "surname",
						Email:    "email",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: mockConnection,
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "surname", Values: []string{"Gerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				}}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			mockConnection.setSearchResult(&result)

			query := &models.LoginUserQuery{
				Username: "roelgerrits",
			}

			sc.userQueryReturns(&models.User{
				Id:    1,
				Email: "roel@test.net",
				Name:  "Roel Gerrits",
				Login: "roelgerrits",
			})
			sc.userOrgsQueryReturns([]*models.UserOrgDTO{})

			// act
			extUser, _ := auth.Login(query)
			userInfo, err := user.Upsert(&user.UpsertArgs{
				SignupAllowed: true,
				ExternalUser:  extUser,
			})

			// assert

			// Check absence of the error
			So(err, ShouldBeNil)

			// User should be searched in ldap
			So(mockConnection.searchCalled, ShouldBeTrue)

			// Info should be updated (email differs)
			So(userInfo.Email, ShouldEqual, "roel@test.com")

			// User should have admin privileges
			So(sc.addOrgUserCmd.Role, ShouldEqual, "Admin")
		})

		authScenario("When login with invalid credentials", func(scenario *scenarioContext) {
			connection := &mockConnection{}
			entry := ldap.Entry{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			connection.bindProvider = func(username, password string) error {
				return &ldap.Error{
					ResultCode: 49,
				}
			}
			auth := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: connection,
				log:        log.New("test-logger"),
			}

			_, err := auth.Login(scenario.loginUserQuery)

			Convey("it should return invalid credentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})
		})

		authScenario("When login with valid credentials", func(scenario *scenarioContext) {
			connection := &mockConnection{}
			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"markelog"}},
					{Name: "surname", Values: []string{"Gaidarenko"}},
					{Name: "email", Values: []string{"markelog@gmail.com"}},
					{Name: "name", Values: []string{"Oleg"}},
					{Name: "memberof", Values: []string{"admins"}},
				},
			}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			connection.bindProvider = func(username, password string) error {
				return nil
			}
			auth := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: connection,
				log:        log.New("test-logger"),
			}

			resp, err := auth.Login(scenario.loginUserQuery)

			So(err, ShouldBeNil)
			So(resp.Login, ShouldEqual, "markelog")
		})
	})
}
