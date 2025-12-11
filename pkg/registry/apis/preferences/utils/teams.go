package utils

import (
	"context"

	authlib "github.com/grafana/authlib/types"
)

//go:generate mockery --name TeamService --structname MockTeamService --inpackage --filename teams_mock.go --with-expecter
type TeamService interface {
	InTeam(ctx context.Context, id authlib.AuthInfo, team string, admin bool) (bool, error)
	GetTeams(ctx context.Context, id authlib.AuthInfo, admin bool) ([]string, error)
}
