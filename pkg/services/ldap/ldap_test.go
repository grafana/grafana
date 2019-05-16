package ldap

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestAuth(t *testing.T) {
	Convey("Add()", t, func() {
		connection := &mockConnection{}

		auth := &Server{
			config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			connection: connection,
			log:        log.New("test-logger"),
		}

		Convey("Adds user", func() {
			err := auth.Add(
				"cn=ldap-tuz,ou=users,dc=grafana,dc=org",
				map[string][]string{
					"mail":         {"ldap-viewer@grafana.com"},
					"userPassword": {"grafana"},
					"objectClass": {
						"person",
						"top",
						"inetOrgPerson",
						"organizationalPerson",
					},
					"sn": {"ldap-tuz"},
					"cn": {"ldap-tuz"},
				},
			)

			hasMail := false
			hasUserPassword := false
			hasObjectClass := false
			hasSN := false
			hasCN := false

			So(err, ShouldBeNil)
			So(connection.addParams.Controls, ShouldBeNil)
			So(connection.addCalled, ShouldBeTrue)
			So(
				connection.addParams.DN,
				ShouldEqual,
				"cn=ldap-tuz,ou=users,dc=grafana,dc=org",
			)

			attrs := connection.addParams.Attributes
			for _, value := range attrs {
				if value.Type == "mail" {
					So(value.Vals, ShouldContain, "ldap-viewer@grafana.com")
					hasMail = true
				}

				if value.Type == "userPassword" {
					hasUserPassword = true
					So(value.Vals, ShouldContain, "grafana")
				}

				if value.Type == "objectClass" {
					hasObjectClass = true
					So(value.Vals, ShouldContain, "person")
					So(value.Vals, ShouldContain, "top")
					So(value.Vals, ShouldContain, "inetOrgPerson")
					So(value.Vals, ShouldContain, "organizationalPerson")
				}

				if value.Type == "sn" {
					hasSN = true
					So(value.Vals, ShouldContain, "ldap-tuz")
				}

				if value.Type == "cn" {
					hasCN = true
					So(value.Vals, ShouldContain, "ldap-tuz")
				}
			}

			So(hasMail, ShouldBeTrue)
			So(hasUserPassword, ShouldBeTrue)
			So(hasObjectClass, ShouldBeTrue)
			So(hasSN, ShouldBeTrue)
			So(hasCN, ShouldBeTrue)
		})
	})

	Convey("Remove()", t, func() {
		connection := &mockConnection{}

		auth := &Server{
			config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			connection: connection,
			log:        log.New("test-logger"),
		}

		Convey("Removes the user", func() {
			dn := "cn=ldap-tuz,ou=users,dc=grafana,dc=org"
			err := auth.Remove(dn)

			So(err, ShouldBeNil)
			So(connection.delCalled, ShouldBeTrue)
			So(connection.delParams.Controls, ShouldBeNil)
			So(connection.delParams.DN, ShouldEqual, dn)
		})
	})

	Convey("ExtractGrafanaUser()", t, func() {
		Convey("When translating ldap user to grafana user", func() {

			var user1 = &m.User{}

			bus.AddHandlerCtx("test", func(ctx context.Context, cmd *m.UpsertUserCommand) error {
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
	})
}
