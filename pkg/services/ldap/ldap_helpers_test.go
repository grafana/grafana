package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"
)

func TestLDAPHelpers(t *testing.T) {
	Convey("isMemberOf()", t, func() {
		Convey("Wildcard", func() {
			result := isMemberOf([]string{}, "*")
			So(result, ShouldBeTrue)
		})

		Convey("Should find one", func() {
			result := isMemberOf([]string{"one", "Two", "three"}, "two")
			So(result, ShouldBeTrue)
		})

		Convey("Should not find one", func() {
			result := isMemberOf([]string{"one", "Two", "three"}, "twos")
			So(result, ShouldBeFalse)
		})
	})

	Convey("getLDAPAttr()", t, func() {
		Convey("Should get wildcard", func() {
			value := []string{"roelgerrits"}
			entry := ldap.Entry{
				DN: "long-dn",
				Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: value},
				},
			}
			search := &ldap.SearchResult{
				Entries: []*ldap.Entry{&entry},
			}

			result := getLDAPAttr("dn", search)

			So(result, ShouldEqual, "long-dn")
		})

		Convey("Should get username", func() {
			value := []string{"roelgerrits"}
			entry := ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			search := &ldap.SearchResult{
				Entries: []*ldap.Entry{&entry},
			}

			result := getLDAPAttr("username", search)

			So(result, ShouldEqual, value[0])
		})
	})

	Convey("getLDAPAttrN()", t, func() {
		Convey("Should get wildcard", func() {
			value := []string{"roelgerrits"}
			entry := ldap.Entry{
				DN: "long-dn",
				Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: value},
				},
			}
			search := &ldap.SearchResult{
				Entries: []*ldap.Entry{
					{},
					&entry,
				},
			}

			result := getLDAPAttrN("dn", search, 1)

			So(result, ShouldEqual, "long-dn")
		})

		Convey("Should get username", func() {
			value := []string{"roelgerrits"}
			entry := ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			search := &ldap.SearchResult{
				Entries: []*ldap.Entry{
					&entry,
					{},
				},
			}

			result := getLDAPAttrN("username", search, 0)

			So(result, ShouldEqual, value[0])
		})

		Convey("Should not get anything", func() {
			value := []string{"roelgerrits"}
			entry := ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			search := &ldap.SearchResult{
				Entries: []*ldap.Entry{
					&entry,
					{},
				},
			}

			result := getLDAPAttrN("something", search, 0)

			So(result, ShouldEqual, "")
		})
	})
}
