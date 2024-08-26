package filters

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewRoleFilter(t *testing.T) {
	t.Run("Empty roles list returns nil filter", func(t *testing.T) {
		filter, err := NewRoleFilter([]string{})
		assert.NoError(t, err)
		assert.Nil(t, filter)
	})

	t.Run("Single empty role returns nil filter", func(t *testing.T) {
		filter, err := NewRoleFilter([]string{""})
		assert.NoError(t, err)
		assert.Nil(t, filter)
	})

	t.Run("Non-empty roles list returns filter", func(t *testing.T) {
		filter, err := NewRoleFilter([]string{"Admin", "Viewer"})
		assert.NoError(t, err)
		assert.NotNil(t, filter)
	})
}

func TestRoleFilter_WhereCondition(t *testing.T) {
	t.Run("Empty roles list returns nil WhereCondition", func(t *testing.T) {
		filter := &RoleFilter{roles: []string{}}
		condition := filter.WhereCondition()
		assert.Nil(t, condition)
	})

	t.Run("Single role returns correct WhereCondition", func(t *testing.T) {
		filter := &RoleFilter{roles: []string{"Admin"}}
		condition := filter.WhereCondition()
		assert.NotNil(t, condition)
		assert.Equal(t, "org_user.role IN ('Admin')", condition.Condition)
		assert.Nil(t, condition.Params)
	})

	t.Run("Multiple roles return correct WhereCondition", func(t *testing.T) {
		filter := &RoleFilter{roles: []string{"Admin", "Viewer"}}
		condition := filter.WhereCondition()
		assert.NotNil(t, condition)
		assert.Equal(t, "org_user.role IN ('Admin','Viewer')", condition.Condition)
		assert.Nil(t, condition.Params)
	})
}
