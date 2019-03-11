package teams

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func CanUpdateTeam(orgId int64, teamId int64, user *m.SignedInUser, editorCanOwn bool) error {
	if user.OrgRole == m.ROLE_ADMIN {
		return nil
	}

	if !editorCanOwn {
		return m.ErrNotAllowedToUpdateTeam
	}

	if user.OrgId != orgId {
		return m.ErrNotAllowedToUpdateTeamInDifferentOrg
	}

	cmd := m.GetTeamMembersQuery{
		OrgId:  orgId,
		TeamId: teamId,
		UserId: user.UserId,
		// TODO: do we need to do something special about external users
		// External: false,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return err
	}

	for _, member := range cmd.Result {
		if member.UserId == user.UserId && member.Permission == int64(m.PERMISSION_ADMIN) {
			return nil
		}
	}

	return m.ErrNotAllowedToUpdateTeam
}
