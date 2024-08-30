package common

import (
	"strconv"

	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/services/team"
)

// OptonalFormatInt formats num as a string. If num is less or equal than 0
// an empty string is returned.
func OptionalFormatInt(num int64) string {
	if num > 0 {
		return strconv.FormatInt(num, 10)
	}
	return ""
}

func MapTeamPermission(p team.PermissionType) identityv0.TeamPermission {
	if p == team.PermissionTypeAdmin {
		return identityv0.TeamPermissionAdmin
	} else {
		return identityv0.TeamPermissionMember
	}
}
