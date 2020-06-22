package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestIsRoleAssignable(t *testing.T) {
	// table test to  validate isRoleAssignable(currentRole, incomingRole)
	assert.True(t, isRoleAssignable("", models.ROLE_VIEWER))
	assert.True(t, isRoleAssignable(models.ROLE_VIEWER, models.ROLE_EDITOR))
	assert.True(t, isRoleAssignable(models.ROLE_VIEWER, models.ROLE_ADMIN))
	assert.True(t, isRoleAssignable(models.ROLE_EDITOR, models.ROLE_ADMIN))
	assert.False(t, isRoleAssignable(models.ROLE_ADMIN, models.ROLE_EDITOR))
	assert.False(t, isRoleAssignable(models.ROLE_ADMIN, models.ROLE_VIEWER))
	assert.False(t, isRoleAssignable(models.ROLE_EDITOR, models.ROLE_VIEWER))
	assert.True(t, isRoleAssignable(models.ROLE_VIEWER, models.ROLE_VIEWER))

	roles := map[int64]models.RoleType{}
	assert.True(t, isRoleAssignable(roles[0], models.ROLE_VIEWER))
}
