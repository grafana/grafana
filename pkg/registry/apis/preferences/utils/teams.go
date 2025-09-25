package utils

import (
	"context"

	authlib "github.com/grafana/authlib/types"
)

type TeamService interface {
	InTeam(ctx context.Context, id authlib.AuthInfo, admin bool) (bool, error)
	GetTeams(ctx context.Context, id authlib.AuthInfo, admin bool) ([]string, error)
}
