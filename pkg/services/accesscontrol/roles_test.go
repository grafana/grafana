package accesscontrol

import (
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPredefinedRoles(t *testing.T) {
	for name, r := range FixedRoles {
		assert.Truef(t,
			strings.HasPrefix(name, "fixed:"),
			"expected all fixed roles to be prefixed by 'fixed:', found role '%s'", name,
		)
		assert.Equal(t, name, r.Name)
		assert.NotZero(t, r.Version)
		// assert.NotEmpty(t, r.Description)
	}
}

func TestPredefinedRoleGrants(t *testing.T) {
	testFixedRoleGrantsMap := func(key, value interface{}) bool {
		v := value.([]string)
		assert.True(t,
			sort.SliceIsSorted(v, func(i, j int) bool {
				return v[i] < v[j]
			}),
			"require role grant lists to be sorted",
		)

		for _, r := range v {
			assert.Contains(t, FixedRoles, r)
		}
		return true
	}

	FixedRoleGrantsMap.Range(testFixedRoleGrantsMap)
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
