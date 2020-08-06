package ldap

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"
)

func TestLDAPPrivateMethods(t *testing.T) {
	Convey("getSearchRequest()", t, func() {
		Convey("with enabled GroupSearchFilterUserAttribute setting", func() {
			server := &Server{
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					GroupSearchFilterUserAttribute: "gansta",
					SearchBaseDNs:                  []string{"BaseDNHere"},
				},
				log: log.New("test-logger"),
			}

			result := server.getSearchRequest("killa", []string{"gorilla"})

			So(result, ShouldResemble, &ldap.SearchRequest{
				BaseDN:       "killa",
				Scope:        2,
				DerefAliases: 0,
				SizeLimit:    0,
				TimeLimit:    0,
				TypesOnly:    false,
				Filter:       "(|)",
				Attributes: []string{
					"username",
					"email",
					"name",
					"memberof",
					"gansta",
				},
				Controls: nil,
			})
		})
	})

	Convey("serializeUsers()", t, func() {
		Convey("simple case", func() {
			server := &Server{
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: &MockConnection{},
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn",
				Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "surname", Values: []string{"Gerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				},
			}
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			So(err, ShouldBeNil)
			So(result[0].Login, ShouldEqual, "roelgerrits")
			So(result[0].Email, ShouldEqual, "roel@test.com")
			So(result[0].Groups, ShouldContain, "admins")
		})

		Convey("without lastname", func() {
			server := &Server{
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: &MockConnection{},
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn",
				Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				},
			}
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			So(err, ShouldBeNil)
			So(result[0].IsDisabled, ShouldBeFalse)
			So(result[0].Name, ShouldEqual, "Roel")
		})

		Convey("a user without matching groups should be marked as disabled", func() {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{{
						GroupDN: "foo",
						OrgId:   1,
						OrgRole: models.ROLE_EDITOR,
					}},
				},
				Connection: &MockConnection{},
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn",
				Attributes: []*ldap.EntryAttribute{
					{Name: "memberof", Values: []string{"admins"}},
				},
			}
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			So(err, ShouldBeNil)
			So(len(result), ShouldEqual, 1)
			So(result[0].IsDisabled, ShouldBeTrue)
		})
	})

	Convey("validateGrafanaUser()", t, func() {
		Convey("Returns error when user does not belong in any of the specified LDAP groups", func() {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{
						{
							OrgId: 1,
						},
					},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
			}

			result := server.validateGrafanaUser(user)

			So(result, ShouldEqual, ErrInvalidCredentials)
		})

		Convey("Does not return error when group config is empty", func() {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
			}

			result := server.validateGrafanaUser(user)

			So(result, ShouldBeNil)
		})

		Convey("Does not return error when groups are there", func() {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{
						{
							OrgId: 1,
						},
					},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
				OrgRoles: map[int64]models.RoleType{
					1: "test",
				},
			}

			result := server.validateGrafanaUser(user)

			So(result, ShouldBeNil)
		})
	})

	Convey("shouldAdminBind()", t, func() {
		Convey("it should require admin userBind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "test",
				},
			}

			result := server.shouldAdminBind()
			So(result, ShouldBeTrue)
		})

		Convey("it should not require admin userBind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "",
				},
			}

			result := server.shouldAdminBind()
			So(result, ShouldBeFalse)
		})
	})

	Convey("shouldSingleBind()", t, func() {
		Convey("it should allow single bind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=%s,dc=grafana,dc=org",
				},
			}

			result := server.shouldSingleBind()
			So(result, ShouldBeTrue)
		})

		Convey("it should not allow single bind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=admin,dc=grafana,dc=org",
				},
			}

			result := server.shouldSingleBind()
			So(result, ShouldBeFalse)
		})
	})

	Convey("singleBindDN()", t, func() {
		Convey("it should allow single bind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=%s,dc=grafana,dc=org",
				},
			}

			result := server.singleBindDN("test")
			So(result, ShouldEqual, "cn=test,dc=grafana,dc=org")
		})
	})
}
