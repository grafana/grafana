package accesscontrol

import (
	"sort"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestFixedRoles(t *testing.T) {
	for name, role := range FixedRoles {
		assert.Truef(t,
			strings.HasPrefix(name, "fixed:"),
			"expected all fixed roles to be prefixed by 'fixed:', found role '%s'", name,
		)
		assert.Equal(t, name, role.Name)
		assert.NotZero(t, role.Version)
	}
}

func TestFixedRoleGrants(t *testing.T) {
	for _, grants := range fixedRoleGrants {
		// Check grants list is sorted
		assert.True(t,
			sort.SliceIsSorted(grants, func(i, j int) bool {
				return grants[i] < grants[j]
			}),
			"require role grant lists to be sorted",
		)

		// Check all granted roles have been registered
		for _, r := range grants {
			assert.Contains(t, FixedRoles, r)
		}
	}
}

func TestGetFixedRoleGrants(t *testing.T) {
	grants := GetFixedRoleGrants(setting.NewCfg())
	assert.Equal(t, fixedRoleGrants, grants, "if no special access control properties are set, fixed roles grants should not be extended")

	grantsWithEditorCanAdmin := GetFixedRoleGrants(&setting.Cfg{EditorsCanAdmin: true})
	assert.Contains(t, grantsWithEditorCanAdmin[string(models.ROLE_EDITOR)], teamsWriter, "if editorsCanAdmin is set, editors can create teams")
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
