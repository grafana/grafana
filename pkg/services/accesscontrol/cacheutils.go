package accesscontrol

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

func GetPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-%s", user.GetCacheKey())
}

func GetUserDirectPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-direct-%s", user.GetCacheKey())
}

func GetBasicRolePermissionCacheKey(role string, orgID int64) string {
	roleKey := strings.Replace(role, " ", "_", -1)
	roleKey = strings.ToLower(roleKey)
	return fmt.Sprintf("rbac-permissions-basic-role-%d-%s", orgID, roleKey)
}

func GetTeamPermissionCacheKey(teamID int64, orgID int64) string {
	return fmt.Sprintf("rbac-permissions-team-%d-%d", orgID, teamID)
}
