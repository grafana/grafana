package accesscontrol

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func GetUserPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-%s", user.GetCacheKey())
}

func GetSearchPermissionCacheKey(user identity.Requester, searchOptions SearchOptions) string {
	key := fmt.Sprintf("rbac-permissions-%s", user.GetCacheKey())
	if searchOptions.Action != "" {
		key += fmt.Sprintf("-%s", searchOptions.Action)
	}
	if searchOptions.Scope != "" {
		key += fmt.Sprintf("-%s", searchOptions.Scope)
	}
	if len(searchOptions.RolePrefixes) > 0 {
		key += "-" + strings.Join(searchOptions.RolePrefixes, "-")
	}
	if searchOptions.ActionPrefix != "" {
		key += fmt.Sprintf("-%s", searchOptions.ActionPrefix)
	}
	return key
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

func GetTeamPermissionCompositeCacheKey(teamIds []int64, orgID int64) string {
	teams := make([]string, 0)
	for _, id := range teamIds {
		teams = append(teams, strconv.FormatInt(id, 10))
	}
	slices.Sort(teams)
	return fmt.Sprintf("rbac-permissions-team-%d-%s", orgID, strings.Join(teams, "-"))
}
