package accesscontrol

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func GetUserPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-%s", user.GetCacheKey())
}

func GetSearchPermissionCacheKey(log log.Logger, user identity.Requester, searchOptions SearchOptions) (string, error) {
	searchHash, err := searchOptions.HashString()
	if err != nil {
		log.Debug("search options failed to compute hash", "err", err.Error())
		return "", err
	}
	key := fmt.Sprintf("rbac-permissions-%s-%s", user.GetCacheKey(), searchHash)
	return key, nil
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
