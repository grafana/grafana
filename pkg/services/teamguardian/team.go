package teamguardian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type TeamGuardian interface {
	CanAdmin(context.Context, int64, int64, *user.SignedInUser) error
	DeleteByUser(context.Context, int64) error
}

type Store interface {
	GetTeamMembers(context.Context, team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error)
	DeleteByUser(context.Context, int64) error
}
