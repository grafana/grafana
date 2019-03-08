package teams

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func canUpdateTeam(orgId int64, teamId int64, user m.SignedInUser) error {
	if user.OrgRole == m.ROLE_ADMIN {
		return nil
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
		// TODO: look into how we want to do logging
		return err
	}

	for _, member := range cmd.Result {
		if member.UserId == user.UserId && member.Permission == int64(m.PERMISSION_ADMIN) {
			return nil
		}
	}

	return m.ErrNotAllowedToUpdateTeam
}

func UpdateTeam(user m.SignedInUser, cmd *m.UpdateTeamCommand) error {
	if err := canUpdateTeam(cmd.OrgId, cmd.Id, user); err != nil {
		return err
	}

	return bus.Dispatch(cmd)
}
