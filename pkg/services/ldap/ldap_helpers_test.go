package ldap

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"gopkg.in/ldap.v3"
)

func TestLDAPHelpers(t *testing.T) {
	t.Run("isMemberOf()", func(t *testing.T) {
		t.Run("Wildcard", func(t *testing.T) {
			result := isMemberOf([]string{}, "*")
			require.True(t, result)
		})

		t.Run("Should find one", func(t *testing.T) {
			result := isMemberOf([]string{"one", "Two", "three"}, "two")
			require.True(t, result)
		})

		t.Run("Should not find one", func(t *testing.T) {
			result := isMemberOf([]string{"one", "Two", "three"}, "twos")
			require.False(t, result)
		})
	})

	t.Run("getUsersIteration()", func(t *testing.T) {
		t.Run("it should execute twice for 600 users", func(t *testing.T) {
			logins := make([]string, 600)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++

				if i == 1 {
					require.Equal(t, 0, previous)
					require.Equal(t, 500, current)
				} else {
					require.Equal(t, 500, previous)
					require.Equal(t, 600, current)
				}

				return nil
			})

			require.Equal(t, 2, i)
			require.Nil(t, result)
		})

		t.Run("it should execute three times for 1500 users", func(t *testing.T) {
			logins := make([]string, 1500)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				switch i {
				case 1:
					require.Equal(t, 0, previous)
					require.Equal(t, 500, current)
				case 2:
					require.Equal(t, 500, previous)
					require.Equal(t, 1000, current)
				default:
					require.Equal(t, 1000, previous)
					require.Equal(t, 1500, current)
				}

				return nil
			})

			require.Equal(t, 3, i)
			require.Nil(t, result)
		})

		t.Run("it should execute once for 400 users", func(t *testing.T) {
			logins := make([]string, 400)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				if i == 1 {
					require.Equal(t, 0, previous)
					require.Equal(t, 400, current)
				}

				return nil
			})

			require.Equal(t, 1, i)
			require.Nil(t, result)
		})

		t.Run("it should not execute for 0 users", func(t *testing.T) {
			logins := make([]string, 0)
			i := 0

			result := getUsersIteration(logins, func(previous, current int) error {
				i++
				return nil
			})

			require.Equal(t, 0, i)
			require.Nil(t, result)
		})
	})

	t.Run("getAttribute()", func(t *testing.T) {
		t.Run("Should get DN", func(t *testing.T) {
			entry := &ldap.Entry{
				DN: "test",
			}

			result := getAttribute("dn", entry)

			require.Equal(t, "test", result)
		})

		t.Run("Should get username", func(t *testing.T) {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getAttribute("username", entry)

			require.Equal(t, value[0], result)
		})

		t.Run("Should not get anything", func(t *testing.T) {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "killa", Values: value,
					},
				},
			}

			result := getAttribute("username", entry)

			require.Equal(t, "", result)
		})
	})

	t.Run("getArrayAttribute()", func(t *testing.T) {
		t.Run("Should get DN", func(t *testing.T) {
			entry := &ldap.Entry{
				DN: "test",
			}

			result := getArrayAttribute("dn", entry)

			require.True(t, cmp.Equal(result, []string{"test"}))
		})

		t.Run("Should get username", func(t *testing.T) {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getArrayAttribute("username", entry)

			require.True(t, cmp.Equal(result, value))
		})

		t.Run("Should not get anything", func(t *testing.T) {
			value := []string{"roelgerrits"}
			entry := &ldap.Entry{
				Attributes: []*ldap.EntryAttribute{
					{
						Name: "username", Values: value,
					},
				},
			}

			result := getArrayAttribute("something", entry)

			require.True(t, cmp.Equal(result, []string{}))
		})
	})
}
