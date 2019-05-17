package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	ldap "gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
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

	Convey("Users()", t, func() {
		Convey("find one user", func() {
			mockConnection := &mockConnection{}
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

			// Set up attribute map without surname and email
			server := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: mockConnection,
				log:        log.New("test-logger"),
			}

			searchResult, err := server.Users([]string{"roelgerrits"})

			So(err, ShouldBeNil)
			So(searchResult, ShouldNotBeNil)

			// User should be searched in ldap
			So(mockConnection.searchCalled, ShouldBeTrue)

			// No empty attributes should be added to the search request
			So(len(mockConnection.searchAttributes), ShouldEqual, 3)
		})
	})
}
