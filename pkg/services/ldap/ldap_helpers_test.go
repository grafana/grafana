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

	Convey("getAttribute()", t, func() {
		Convey("Should get username", func() {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getAttribute("username", entry)

			So(result, ShouldEqual, value[0])
		})

		Convey("Should not get anything", func() {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "killa", Values: value,
					},
				},
			}

			result := getAttribute("username", entry)

			So(result, ShouldEqual, "")
		})
	})

	Convey("getArrayAttribute()", t, func() {
		Convey("Should get username", func() {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getArrayAttribute("username", entry)

			So(result, ShouldResemble, value)
		})

		Convey("Should not get anything", func() {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getArrayAttribute("something", entry)

			So(result, ShouldResemble, []string{})
		})
	})
}
