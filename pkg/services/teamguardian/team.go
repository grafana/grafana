package teamguardian

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type TeamGuardian interface {
	CanAdmin(ctx context.Context, orgId int64, teamId int64, user *models.SignedInUser) error
}

type Store interface {
	GetTeamMembers(ctx context.Context, query models.GetTeamMembersQuery) ([]*models.TeamMemberDTO, error)
}
