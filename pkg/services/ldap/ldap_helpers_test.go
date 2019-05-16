package ldap

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLDAPHelpers(t *testing.T) {

	Convey("serverBind()", t, func() {
		Convey("Given bind dn and password configured", func() {
			connection := &mockConnection{}
			var actualUsername, actualPassword string
			connection.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			Auth := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN:       "o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := Auth.serverBind()
			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
			connection := &mockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			Auth := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN: "o=users,dc=grafana,dc=org",
				},
			}
			err := Auth.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
		})

		Convey("Given empty bind dn and password", func() {
			connection := &mockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			Auth := &Server{
				connection: connection,
				config:     &ServerConfig{},
			}
			err := Auth.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})

	Convey("searchUser()", t, func() {
		Convey("When searching for a user and not all five attributes are mapped", func() {
			mockConnectionection := &mockConnection{}
			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "surname", Values: []string{"Gerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				}}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			mockConnectionection.setSearchResult(&result)

			// Set up attribute map without surname and email
			Auth := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: mockConnectionection,
				log:        log.New("test-logger"),
			}

			searchResult, err := Auth.searchUser("roelgerrits")

			So(err, ShouldBeNil)
			So(searchResult, ShouldNotBeNil)

			// User should be searched in ldap
			So(mockConnectionection.searchCalled, ShouldBeTrue)

			// No empty attributes should be added to the search request
			So(len(mockConnectionection.searchAttributes), ShouldEqual, 3)
		})
	})

	Convey("ExtractGrafanaUser()", t, func() {

		Convey("When translating ldap user to grafana user", func() {

			var user1 = &models.User{}

			bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.UpsertUserCommand) error {
				cmd.Result = user1
				cmd.Result.Login = "torkelo"
				return nil
			})

			Convey("Given no ldap group map match", func() {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{{}},
				})
				_, err := Auth.ExtractGrafanaUser(&UserInfo{})

				So(err, ShouldEqual, ErrInvalidCredentials)
			})

			authScenario("Given wildcard group match", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "*", OrgRole: "Admin"},
					},
				})

				sc.userQueryReturns(user1)

				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{})
				result, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				So(extractErr, ShouldBeNil)
				So(err, ShouldBeNil)
				So(result, ShouldEqual, user1)
			})

			authScenario("Given exact group match", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=users", OrgRole: "Admin"},
					},
				})

				sc.userQueryReturns(user1)

				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{MemberOf: []string{"cn=users"}})
				result, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				So(extractErr, ShouldBeNil)
				So(err, ShouldBeNil)
				So(result, ShouldEqual, user1)
			})

			authScenario("Given group match with different case", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=users", OrgRole: "Admin"},
					},
				})

				sc.userQueryReturns(user1)

				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{MemberOf: []string{"CN=users"}})
				result, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				So(extractErr, ShouldBeNil)
				So(err, ShouldBeNil)
				So(result, ShouldEqual, user1)
			})

			authScenario("Given no existing grafana user", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=admin", OrgRole: "Admin"},
						{GroupDN: "cn=editor", OrgRole: "Editor"},
						{GroupDN: "*", OrgRole: "Viewer"},
					},
				})

				sc.userQueryReturns(nil)

				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					DN:       "torkelo",
					Username: "torkelo",
					Email:    "my@email.com",
					MemberOf: []string{"cn=editor"},
				})
				result, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				So(extractErr, ShouldBeNil)
				So(err, ShouldBeNil)

				Convey("Should return new user", func() {
					So(result.Login, ShouldEqual, "torkelo")
				})

				Convey("Should set isGrafanaAdmin to false by default", func() {
					So(result.IsAdmin, ShouldBeFalse)
				})

			})

		})

		Convey("When syncing ldap groups to grafana org roles", func() {
			authScenario("given no current user orgs", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=users", OrgRole: "Admin"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=users"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should create new org user", func() {
					So(extractErr, ShouldBeNil)
					So(err, ShouldBeNil)
					So(sc.addOrgUserCmd, ShouldNotBeNil)
					So(sc.addOrgUserCmd.Role, ShouldEqual, models.ROLE_ADMIN)
				})
			})

			authScenario("given different current org role", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=users", OrgId: 1, OrgRole: "Admin"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{{OrgId: 1, Role: models.ROLE_EDITOR}})

				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=users"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should update org role", func() {
					So(err, ShouldBeNil)
					So(extractErr, ShouldBeNil)
					So(sc.updateOrgUserCmd, ShouldNotBeNil)
					So(sc.updateOrgUserCmd.Role, ShouldEqual, models.ROLE_ADMIN)
					So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
				})
			})

			authScenario("given current org role is removed in ldap", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=users", OrgId: 2, OrgRole: "Admin"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{
					{OrgId: 1, Role: models.ROLE_EDITOR},
					{OrgId: 2, Role: models.ROLE_EDITOR},
				})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=users"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should remove org role", func() {
					So(extractErr, ShouldBeNil)
					So(err, ShouldBeNil)
					So(sc.removeOrgUserCmd, ShouldNotBeNil)
					So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 2)
				})
			})

			authScenario("given org role is updated in config", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=admin", OrgId: 1, OrgRole: "Admin"},
						{GroupDN: "cn=users", OrgId: 1, OrgRole: "Viewer"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{{OrgId: 1, Role: models.ROLE_EDITOR}})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=users"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should update org role", func() {
					So(extractErr, ShouldBeNil)
					So(err, ShouldBeNil)

					So(sc.removeOrgUserCmd, ShouldBeNil)
					So(sc.updateOrgUserCmd, ShouldNotBeNil)
					So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
				})
			})

			authScenario("given multiple matching ldap groups", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin"},
						{GroupDN: "*", OrgId: 1, OrgRole: "Viewer"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{{OrgId: 1, Role: models.ROLE_ADMIN}})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=admins"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should take first match, and ignore subsequent matches", func() {
					So(err, ShouldBeNil)
					So(extractErr, ShouldBeNil)

					So(sc.updateOrgUserCmd, ShouldBeNil)
					So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
				})
			})

			authScenario("given multiple matching ldap groups and no existing groups", func(sc *scenarioContext) {
				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin"},
						{GroupDN: "*", OrgId: 1, OrgRole: "Viewer"},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=admins"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should take first match, and ignore subsequent matches", func() {
					So(extractErr, ShouldBeNil)
					So(err, ShouldBeNil)

					So(sc.addOrgUserCmd.Role, ShouldEqual, models.ROLE_ADMIN)
					So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
				})

				Convey("Should not update permissions unless specified", func() {
					So(err, ShouldBeNil)
					So(sc.updateUserPermissionsCmd, ShouldBeNil)
				})
			})

			authScenario("given ldap groups with grafana_admin=true", func(sc *scenarioContext) {
				trueVal := true

				Auth := New(&ServerConfig{
					Groups: []*GroupToOrgRole{
						{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin", IsGrafanaAdmin: &trueVal},
					},
				})

				sc.userOrgsQueryReturns([]*models.UserOrgDTO{})
				extUser, extractErr := Auth.ExtractGrafanaUser(&UserInfo{
					MemberOf: []string{"cn=admins"},
				})
				_, err := user.Upsert(&user.UpsertArgs{
					SignupAllowed: true,
					ExternalUser:  extUser,
				})

				Convey("Should create user with admin set to true", func() {
					So(extractErr, ShouldBeNil)
					So(err, ShouldBeNil)

					So(sc.updateUserPermissionsCmd.IsGrafanaAdmin, ShouldBeTrue)
				})
			})
		})
	})
}
