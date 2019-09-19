package teamguardian

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func CanAdmin(bus bus.Bus, orgId int64, teamId int64, user *m.SignedInUser) error {
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
	}

	if err := bus.DispatchCtx(context.TODO(), &cmd); err != nil {
		return err
	}

	for _, member := range cmd.Result {
		if member.UserId == user.UserId && member.Permission == m.PERMISSION_ADMIN {
			return nil
		}
	}

	return m.ErrNotAllowedToUpdateTeam
}
