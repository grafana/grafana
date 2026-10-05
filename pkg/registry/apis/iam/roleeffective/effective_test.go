package roleeffective

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestResolveEffective(t *testing.T) {
	t.Run("forwards each complete ref to the resolver", func(t *testing.T) {
		role := &iamv0.Role{Spec: iamv0.RoleSpec{RoleRefs: []iamv0.RolespecRoleRef{
			{Kind: "GlobalRole", Name: "same-name"},
			{Kind: "Role", Name: "same-name"},
		}}}
		var got []iamv0.RolespecRoleRef
		effective, hasRefs, err := ResolveEffective(role, func(ref iamv0.RolespecRoleRef) ([]ActionScope, error) {
			got = append(got, ref)
			return []ActionScope{{Action: ref.Kind, Scope: ref.Name}}, nil
		})
		require.NoError(t, err)
		assert.True(t, hasRefs)
		assert.ElementsMatch(t, role.Spec.RoleRefs, got)
		assert.ElementsMatch(t, []ActionScope{{Action: "GlobalRole", Scope: "same-name"}, {Action: "Role", Scope: "same-name"}}, effective)
	})

	t.Run("no refs", func(t *testing.T) {
		calls := 0
		effective, hasRefs, err := ResolveEffective(&iamv0.Role{}, func(iamv0.RolespecRoleRef) ([]ActionScope, error) {
			calls++
			return nil, nil
		})
		require.NoError(t, err)
		assert.Nil(t, effective)
		assert.False(t, hasRefs)
		assert.Zero(t, calls)
	})

	t.Run("composes inherited, omitted, explicit, and duplicate permissions", func(t *testing.T) {
		role := &iamv0.Role{ObjectMeta: metav1.ObjectMeta{Name: "role"}, Spec: iamv0.RoleSpec{
			RoleRefs:           []iamv0.RolespecRoleRef{{Kind: "GlobalRole", Name: "base"}},
			PermissionsOmitted: []iamv0.RolespecPermission{{Action: "read", Scope: "removed"}, {Action: "read", Scope: "readded"}},
			Permissions:        []iamv0.RolespecPermission{{Action: "read", Scope: "own"}, {Action: "read", Scope: "readded"}},
		}}
		effective, hasRefs, err := ResolveEffective(role, func(ref iamv0.RolespecRoleRef) ([]ActionScope, error) {
			require.Equal(t, iamv0.RolespecRoleRef{Kind: "GlobalRole", Name: "base"}, ref)
			return []ActionScope{{Action: "read", Scope: "kept"}, {Action: "read", Scope: "removed"}, {Action: "read", Scope: "readded"}, {Action: "read", Scope: "kept"}}, nil
		})
		require.NoError(t, err)
		assert.True(t, hasRefs)
		assert.ElementsMatch(t, []ActionScope{{Action: "read", Scope: "kept"}, {Action: "read", Scope: "own"}, {Action: "read", Scope: "readded"}}, effective)
	})

	t.Run("callback error remains wrapped and returns no partial permissions", func(t *testing.T) {
		cause := errors.New("lookup failed")
		role := &iamv0.Role{Spec: iamv0.RoleSpec{RoleRefs: []iamv0.RolespecRoleRef{
			{Kind: "GlobalRole", Name: "first"}, {Kind: "Role", Name: "second"},
		}}}
		calls := 0
		effective, hasRefs, err := ResolveEffective(role, func(iamv0.RolespecRoleRef) ([]ActionScope, error) {
			calls++
			if calls == 1 {
				return []ActionScope{{Action: "read", Scope: "inherited"}}, nil
			}
			return nil, cause
		})
		require.ErrorIs(t, err, cause)
		assert.ErrorContains(t, err, `kind "Role" name "second"`)
		assert.Nil(t, effective)
		assert.True(t, hasRefs)
		assert.Equal(t, 2, calls)
	})
}
