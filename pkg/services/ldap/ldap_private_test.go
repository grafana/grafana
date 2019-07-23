package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
			So(result[0].Name, ShouldEqual, "Roel")
		})
	})

	Convey("validateGrafanaUser()", t, func() {
		Convey("Returns error when user does not belong in any of the specified LDAP groups", func() {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{
						{
							OrgID: 1,
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
							OrgID: 1,
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

	Convey("shouldAuthAdmin()", t, func() {
		Convey("it should require admin userBind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "test",
				},
			}

			result := server.shouldAuthAdmin()
			So(result, ShouldBeTrue)
		})

		Convey("it should not require admin userBind", func() {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "",
				},
			}

			result := server.shouldAuthAdmin()
			So(result, ShouldBeFalse)
		})
	})

}
