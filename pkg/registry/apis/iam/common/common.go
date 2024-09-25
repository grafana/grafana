package common

import (
	"strconv"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
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

func MapTeamPermission(p team.PermissionType) iamv0.TeamPermission {
	if p == team.PermissionTypeAdmin {
		return iamv0.TeamPermissionAdmin
	} else {
		return iamv0.TeamPermissionMember
	}
}
