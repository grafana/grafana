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

	Convey("getUsersIteration()", t, func() {
		Convey("it should execute twice for 600 users", func() {
			logins := make([]string, 600)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++

				if i == 1 {
					So(previous, ShouldEqual, 0)
					So(current, ShouldEqual, 500)
				} else {
					So(previous, ShouldEqual, 500)
					So(current, ShouldEqual, 600)
				}

				return nil
			})

			So(i, ShouldEqual, 2)
			So(result, ShouldBeNil)
		})

		Convey("it should execute three times for 1500 users", func() {
			logins := make([]string, 1500)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				switch i {
				case 1:
					So(previous, ShouldEqual, 0)
					So(current, ShouldEqual, 500)
				case 2:
					So(previous, ShouldEqual, 500)
					So(current, ShouldEqual, 1000)
				default:
					So(previous, ShouldEqual, 1000)
					So(current, ShouldEqual, 1500)
				}

				return nil
			})

			So(i, ShouldEqual, 3)
			So(result, ShouldBeNil)
		})

		Convey("it should execute once for 400 users", func() {
			logins := make([]string, 400)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				if i == 1 {
					So(previous, ShouldEqual, 0)
					So(current, ShouldEqual, 400)
				}

				return nil
			})

			So(i, ShouldEqual, 1)
			So(result, ShouldBeNil)
		})

		Convey("it should not execute for 0 users", func() {
			logins := make([]string, 0)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				return nil
			})

			So(i, ShouldEqual, 0)
			So(result, ShouldBeNil)
		})
	})

	Convey("getAttribute()", t, func() {
		Convey("Should get DN", func() {
			entry := &ldap.Entry{
				DN: "test",
			}

			result := getAttribute("dn", entry)

			So(result, ShouldEqual, "test")
		})

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
		Convey("Should get DN", func() {
			entry := &ldap.Entry{
				DN: "test",
			}

			result := getArrayAttribute("dn", entry)

			So(result, ShouldResemble, []string{"test"})
		})

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
