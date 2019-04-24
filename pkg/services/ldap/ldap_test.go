package ldap

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func TestLdapAuther(t *testing.T) {
	Convey("initialBind", t, func() {
		Convey("Given bind dn and password configured", func() {
			conn := &mockLdapConn{}
			var actualUsername, actualPassword string
			conn.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			ldapAuther := &ldapAuther{
				conn: conn,
				server: &LdapServerConf{
					BindDN:       "cn=%s,o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := ldapAuther.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(ldapAuther.requireSecondBind, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
			conn := &mockLdapConn{}
			var actualUsername, actualPassword string
			conn.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			ldapAuther := &ldapAuther{
				conn: conn,
				server: &LdapServerConf{
					BindDN: "cn=%s,o=users,dc=grafana,dc=org",
				},
			}
			err := ldapAuther.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(ldapAuther.requireSecondBind, ShouldBeFalse)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "pwd")
		})

		Convey("Given empty bind dn and password", func() {
			conn := &mockLdapConn{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			conn.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			ldapAuther := &ldapAuther{
				conn:   conn,
				server: &LdapServerConf{},
			}
			err := ldapAuther.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(ldapAuther.requireSecondBind, ShouldBeTrue)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})

	Convey("serverBind", t, func() {
		Convey("Given bind dn and password configured", func() {
			conn := &mockLdapConn{}
			var actualUsername, actualPassword string
			conn.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			ldapAuther := &ldapAuther{
				conn: conn,
				server: &LdapServerConf{
					BindDN:       "o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := ldapAuther.serverBind()
			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
			conn := &mockLdapConn{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			conn.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			ldapAuther := &ldapAuther{
				conn: conn,
				server: &LdapServerConf{
					BindDN: "o=users,dc=grafana,dc=org",
				},
			}
			err := ldapAuther.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
		})

		Convey("Given empty bind dn and password", func() {
			conn := &mockLdapConn{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			conn.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			ldapAuther := &ldapAuther{
				conn:   conn,
				server: &LdapServerConf{},
			}
			err := ldapAuther.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})

	Convey("When translating ldap user to grafana user", t, func() {

		var user1 = &m.User{}

		bus.AddHandlerCtx("test", func(ctx context.Context, cmd *m.UpsertUserCommand) error {
			cmd.Result = user1
			cmd.Result.Login = "torkelo"
			return nil
		})

		Convey("Given no ldap group map match", func() {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{{}},
			})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{})

			So(err, ShouldEqual, ErrInvalidCredentials)
		})

		ldapAutherScenario("Given wildcard group match", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "*", OrgRole: "Admin"},
				},
			})

			sc.userQueryReturns(user1)

			result, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{})
			So(err, ShouldBeNil)
			So(result, ShouldEqual, user1)
		})

		ldapAutherScenario("Given exact group match", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=users", OrgRole: "Admin"},
				},
			})

			sc.userQueryReturns(user1)

			result, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{MemberOf: []string{"cn=users"}})
			So(err, ShouldBeNil)
			So(result, ShouldEqual, user1)
		})

		ldapAutherScenario("Given group match with different case", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=users", OrgRole: "Admin"},
				},
			})

			sc.userQueryReturns(user1)

			result, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{MemberOf: []string{"CN=users"}})
			So(err, ShouldBeNil)
			So(result, ShouldEqual, user1)
		})

		ldapAutherScenario("Given no existing grafana user", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=admin", OrgRole: "Admin"},
					{GroupDN: "cn=editor", OrgRole: "Editor"},
					{GroupDN: "*", OrgRole: "Viewer"},
				},
			})

			sc.userQueryReturns(nil)

			result, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				DN:       "torkelo",
				Username: "torkelo",
				Email:    "my@email.com",
				MemberOf: []string{"cn=editor"},
			})

			So(err, ShouldBeNil)

			Convey("Should return new user", func() {
				So(result.Login, ShouldEqual, "torkelo")
			})

			Convey("Should set isGrafanaAdmin to false by default", func() {
				So(result.IsAdmin, ShouldBeFalse)
			})

		})

	})

	Convey("When syncing ldap groups to grafana org roles", t, func() {
		ldapAutherScenario("given no current user orgs", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=users", OrgRole: "Admin"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=users"},
			})

			Convey("Should create new org user", func() {
				So(err, ShouldBeNil)
				So(sc.addOrgUserCmd, ShouldNotBeNil)
				So(sc.addOrgUserCmd.Role, ShouldEqual, m.ROLE_ADMIN)
			})
		})

		ldapAutherScenario("given different current org role", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=users", OrgId: 1, OrgRole: "Admin"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{{OrgId: 1, Role: m.ROLE_EDITOR}})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=users"},
			})

			Convey("Should update org role", func() {
				So(err, ShouldBeNil)
				So(sc.updateOrgUserCmd, ShouldNotBeNil)
				So(sc.updateOrgUserCmd.Role, ShouldEqual, m.ROLE_ADMIN)
				So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
			})
		})

		ldapAutherScenario("given current org role is removed in ldap", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=users", OrgId: 2, OrgRole: "Admin"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{
				{OrgId: 1, Role: m.ROLE_EDITOR},
				{OrgId: 2, Role: m.ROLE_EDITOR},
			})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=users"},
			})

			Convey("Should remove org role", func() {
				So(err, ShouldBeNil)
				So(sc.removeOrgUserCmd, ShouldNotBeNil)
				So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 2)
			})
		})

		ldapAutherScenario("given org role is updated in config", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=admin", OrgId: 1, OrgRole: "Admin"},
					{GroupDN: "cn=users", OrgId: 1, OrgRole: "Viewer"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{{OrgId: 1, Role: m.ROLE_EDITOR}})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=users"},
			})

			Convey("Should update org role", func() {
				So(err, ShouldBeNil)
				So(sc.removeOrgUserCmd, ShouldBeNil)
				So(sc.updateOrgUserCmd, ShouldNotBeNil)
				So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
			})
		})

		ldapAutherScenario("given multiple matching ldap groups", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin"},
					{GroupDN: "*", OrgId: 1, OrgRole: "Viewer"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{{OrgId: 1, Role: m.ROLE_ADMIN}})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=admins"},
			})

			Convey("Should take first match, and ignore subsequent matches", func() {
				So(err, ShouldBeNil)
				So(sc.updateOrgUserCmd, ShouldBeNil)
				So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
			})
		})

		ldapAutherScenario("given multiple matching ldap groups and no existing groups", func(sc *scenarioContext) {
			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin"},
					{GroupDN: "*", OrgId: 1, OrgRole: "Viewer"},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=admins"},
			})

			Convey("Should take first match, and ignore subsequent matches", func() {
				So(err, ShouldBeNil)
				So(sc.addOrgUserCmd.Role, ShouldEqual, m.ROLE_ADMIN)
				So(sc.setUsingOrgCmd.OrgId, ShouldEqual, 1)
			})

			Convey("Should not update permissions unless specified", func() {
				So(err, ShouldBeNil)
				So(sc.updateUserPermissionsCmd, ShouldBeNil)
			})
		})

		ldapAutherScenario("given ldap groups with grafana_admin=true", func(sc *scenarioContext) {
			trueVal := true

			ldapAuther := New(&LdapServerConf{
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "cn=admins", OrgId: 1, OrgRole: "Admin", IsGrafanaAdmin: &trueVal},
				},
			})

			sc.userOrgsQueryReturns([]*m.UserOrgDTO{})
			_, err := ldapAuther.GetGrafanaUserFor(nil, &LdapUserInfo{
				MemberOf: []string{"cn=admins"},
			})

			Convey("Should create user with admin set to true", func() {
				So(err, ShouldBeNil)
				So(sc.updateUserPermissionsCmd.IsGrafanaAdmin, ShouldBeTrue)
			})
		})
	})

	Convey("When calling SyncUser", t, func() {
		mockLdapConnection := &mockLdapConn{}

		auth := &ldapAuther{
			server: &LdapServerConf{
				Host:       "",
				RootCACert: "",
				LdapGroups: []*LdapGroupToOrgRole{
					{GroupDN: "*", OrgRole: "Admin"},
				},
				Attr: LdapAttributeMap{
					Username: "username",
					Surname:  "surname",
					Email:    "email",
					Name:     "name",
					MemberOf: "memberof",
				},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			conn: mockLdapConnection,
			log:  log.New("test-logger"),
		}

		dialCalled := false
		dial = func(network, addr string) (ILdapConn, error) {
			dialCalled = true
			return mockLdapConnection, nil
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
		mockLdapConnection.setSearchResult(&result)

		ldapAutherScenario("When ldapUser found call syncInfo and orgRoles", func(sc *scenarioContext) {
			// arrange
			query := &m.LoginUserQuery{
				Username: "roelgerrits",
			}

			hookDial = nil

			sc.userQueryReturns(&m.User{
				Id:    1,
				Email: "roel@test.net",
				Name:  "Roel Gerrits",
				Login: "roelgerrits",
			})
			sc.userOrgsQueryReturns([]*m.UserOrgDTO{})

			// act
			syncErrResult := auth.SyncUser(query)

			// assert
			So(dialCalled, ShouldBeTrue)
			So(syncErrResult, ShouldBeNil)
			// User should be searched in ldap
			So(mockLdapConnection.searchCalled, ShouldBeTrue)
			// Info should be updated (email differs)
			So(sc.updateUserCmd.Email, ShouldEqual, "roel@test.com")
			// User should have admin privileges
			So(sc.addOrgUserCmd.UserId, ShouldEqual, 1)
			So(sc.addOrgUserCmd.Role, ShouldEqual, "Admin")
		})
	})

	Convey("When searching for a user and not all five attributes are mapped", t, func() {
		mockLdapConnection := &mockLdapConn{}
		entry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"roelgerrits"}},
				{Name: "surname", Values: []string{"Gerrits"}},
				{Name: "email", Values: []string{"roel@test.com"}},
				{Name: "name", Values: []string{"Roel"}},
				{Name: "memberof", Values: []string{"admins"}},
			}}
		result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
		mockLdapConnection.setSearchResult(&result)

		// Set up attribute map without surname and email
		ldapAuther := &ldapAuther{
			server: &LdapServerConf{
				Attr: LdapAttributeMap{
					Username: "username",
					Name:     "name",
					MemberOf: "memberof",
				},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			conn: mockLdapConnection,
			log:  log.New("test-logger"),
		}

		searchResult, err := ldapAuther.searchForUser("roelgerrits")

		So(err, ShouldBeNil)
		So(searchResult, ShouldNotBeNil)

		// User should be searched in ldap
		So(mockLdapConnection.searchCalled, ShouldBeTrue)

		// No empty attributes should be added to the search request
		So(len(mockLdapConnection.searchAttributes), ShouldEqual, 3)
	})
}
