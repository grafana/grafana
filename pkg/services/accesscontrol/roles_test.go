package accesscontrol

import (
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPredefinedRoles(t *testing.T) {
	testFixedRolesMap := func(key, value interface{}) bool {
		name := key.(string)
		role := value.(RoleDTO)

		assert.Truef(t,
			strings.HasPrefix(name, "fixed:"),
			"expected all fixed roles to be prefixed by 'fixed:', found role '%s'", name,
		)
		assert.Equal(t, name, role.Name)
		assert.NotZero(t, role.Version)
		return true
	}
	FixedRoles.Range(testFixedRolesMap)
}

func TestPredefinedRoleGrants(t *testing.T) {
	testFixedRoleGrantsMap := func(_, value interface{}) bool {
		roles := value.([]string)
		// Check grants list is sorted
		assert.True(t,
			sort.SliceIsSorted(roles, func(i, j int) bool {
				return roles[i] < roles[j]
			}),
			"require role grant lists to be sorted",
		)

		// Check all granted roles have been registered
		for _, r := range roles {
			_, ok := FixedRoles.Load(r)
			assert.True(t, ok)
		}
		return true
	}

	FixedRoleGrants.Range(testFixedRoleGrantsMap)
}

func TestConcatPermissions(t *testing.T) {
	perms1 := []Permission{
		{
			Action: "test",
			Scope:  "test:*",
		},
		{
			Action: "test1",
			Scope:  "test1:*",
		},
	}
	perms2 := []Permission{
		{
			Action: "test1",
			Scope:  "*",
		},
	}

	expected := []Permission{
		{
			Action: "test",
			Scope:  "test:*",
		},
		{
			Action: "test1",
			Scope:  "test1:*",
		},
		{
			Action: "test1",
			Scope:  "*",
		},
	}

	perms := ConcatPermissions(perms1, perms2)
	assert.ElementsMatch(t, perms, expected)
}
