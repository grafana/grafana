package resourcepermission

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewMapper(t *testing.T) {
	t.Run("default mapper uses uid attribute", func(t *testing.T) {
		m := NewMapper("folders", []string{"view", "edit", "admin"})

		require.Equal(t, "folders:uid:fold1", m.Scope("fold1"))
		require.Equal(t, "folders:uid:%", m.ScopePattern())
		require.Equal(t, []string{"folders:view", "folders:edit", "folders:admin"}, m.ActionSets())
	})
}

func TestNewMapperWithAttribute(t *testing.T) {
	t.Run("mapper with uid attribute", func(t *testing.T) {
		m := NewMapperWithAttribute("folders", []string{"view", "edit", "admin"}, "uid")

		require.Equal(t, "folders:uid:fold1", m.Scope("fold1"))
		require.Equal(t, "folders:uid:%", m.ScopePattern())
	})

	t.Run("mapper with id attribute", func(t *testing.T) {
		m := NewMapperWithAttribute("serviceaccounts", []string{"edit", "admin"}, "id")

		require.Equal(t, "serviceaccounts:id:123", m.Scope("123"))
		require.Equal(t, "serviceaccounts:id:%", m.ScopePattern())
	})

	t.Run("action sets are correctly generated for service accounts", func(t *testing.T) {
		m := NewMapperWithAttribute("serviceaccounts", []string{"edit", "admin"}, "id")

		actionSets := m.ActionSets()
		require.Len(t, actionSets, 2)
		require.Contains(t, actionSets, "serviceaccounts:edit")
		require.Contains(t, actionSets, "serviceaccounts:admin")
	})

	t.Run("ActionSet returns correct action set for valid level", func(t *testing.T) {
		m := NewMapperWithAttribute("serviceaccounts", []string{"edit", "admin"}, "id")

		actionSet, err := m.ActionSet("edit")
		require.NoError(t, err)
		require.Equal(t, "serviceaccounts:edit", actionSet)

		actionSet, err = m.ActionSet("admin")
		require.NoError(t, err)
		require.Equal(t, "serviceaccounts:admin", actionSet)
	})

	t.Run("ActionSet returns error for invalid level", func(t *testing.T) {
		m := NewMapperWithAttribute("serviceaccounts", []string{"edit", "admin"}, "id")

		// "view" is not valid for service accounts
		_, err := m.ActionSet("view")
		require.Error(t, err)
		require.ErrorIs(t, err, errInvalidSpec)

		_, err = m.ActionSet("delete")
		require.Error(t, err)
		require.ErrorIs(t, err, errInvalidSpec)
	})
}
