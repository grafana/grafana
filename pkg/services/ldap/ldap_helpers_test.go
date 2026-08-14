package ldap

import (
	"fmt"
	"testing"

	"github.com/go-ldap/ldap/v3"
	"github.com/stretchr/testify/assert"
)

func TestIsMemberOf(t *testing.T) {
	tests := []struct {
		memberOf []string
		group    string
		expected bool
	}{
		{memberOf: []string{}, group: "*", expected: true},
		{memberOf: []string{"one", "Two", "three"}, group: "two", expected: true},
		{memberOf: []string{"one", "Two", "three"}, group: "twos", expected: false},
	}

	for _, tc := range tests {
		t.Run(fmt.Sprintf("isMemberOf(%v, \"%s\") = %v", tc.memberOf, tc.group, tc.expected), func(t *testing.T) {
			assert.Equal(t, tc.expected, IsMemberOf(tc.memberOf, tc.group))
		})
	}
}

func TestGetUsersIteration(t *testing.T) {
	const pageSize = UsersMaxRequest
	iterations := map[int]int{
		0:    0,
		400:  1,
		600:  2,
		1500: 3,
	}

	for userCount, expectedIterations := range iterations {
		t.Run(fmt.Sprintf("getUserIteration iterates %d times for %d users", expectedIterations, userCount), func(t *testing.T) {
			logins := make([]string, userCount)

			i := 0
			_ = getUsersIteration(logins, func(first int, last int) error {
				assert.Equal(t, pageSize*i, first)

				expectedLast := pageSize*i + pageSize
				if expectedLast > userCount {
					expectedLast = userCount
				}

				assert.Equal(t, expectedLast, last)

				i++
				return nil
			})

			assert.Equal(t, expectedIterations, i)
		})
	}
}

func TestGetAttribute(t *testing.T) {
	t.Run("DN", func(t *testing.T) {
		entry := &ldap.Entry{
			DN: "test",
		}

		result := getAttribute("dn", entry)
		assert.Equal(t, "test", result)
	})

	t.Run("username", func(t *testing.T) {
		value := "roelgerrits"
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "username", Values: []string{value},
				},
			},
		}

		result := getAttribute("username", entry)
		assert.Equal(t, value, result)
	})

	t.Run("letter case mismatch", func(t *testing.T) {
		value := "roelgerrits"
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "sAMAccountName", Values: []string{value},
				},
			},
		}

		result := getAttribute("samaccountname", entry)
		assert.Equal(t, value, result)
	})

	t.Run("no result", func(t *testing.T) {
		value := []string{"roelgerrits"}
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "killa", Values: value,
				},
			},
		}

		result := getAttribute("username", entry)
		assert.Empty(t, result)
	})
}

func TestGetArrayAttribute(t *testing.T) {
	t.Run("DN", func(t *testing.T) {
		entry := &ldap.Entry{
			DN: "test",
		}

		result := getArrayAttribute("dn", entry)

		assert.EqualValues(t, []string{"test"}, result)
	})

	t.Run("username", func(t *testing.T) {
		value := []string{"roelgerrits"}
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "username", Values: value,
				},
			},
		}

		result := getArrayAttribute("username", entry)

		assert.EqualValues(t, value, result)
	})

	t.Run("letter case mismatch", func(t *testing.T) {
		value := []string{"CN=Administrators,CN=Builtin,DC=grafana,DC=org"}
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "memberOf", Values: value,
				},
			},
		}

		result := getArrayAttribute("memberof", entry)

		assert.EqualValues(t, value, result)
	})

	t.Run("no result", func(t *testing.T) {
		value := []string{"roelgerrits"}
		entry := &ldap.Entry{
			Attributes: []*ldap.EntryAttribute{
				{
					Name: "username", Values: value,
				},
			},
		}

		result := getArrayAttribute("something", entry)

		assert.Empty(t, result)
	})
}
