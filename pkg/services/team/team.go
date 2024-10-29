package team

import (
	"context"
	"strconv"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type Service interface {
	CreateTeam(ctx context.Context, name, email string, orgID int64) (Team, error)
	UpdateTeam(ctx context.Context, cmd *UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *SearchTeamsQuery) (SearchTeamQueryResult, error)
	GetTeamByID(ctx context.Context, query *GetTeamByIDQuery) (*TeamDTO, error)
	GetTeamsByUser(ctx context.Context, query *GetTeamsByUserQuery) ([]*TeamDTO, error)
	GetTeamIDsByUser(ctx context.Context, query *GetTeamIDsByUserQuery) ([]int64, error)
	IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error)
	RemoveUsersMemberships(tx context.Context, userID int64) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*TeamMemberDTO, error)
	GetTeamMembers(ctx context.Context, query *GetTeamMembersQuery) ([]*TeamMemberDTO, error)
	RegisterDelete(query string)
}

func MiddlewareTeamUIDResolver(teamService Service, paramName string) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// Get team id from request, fetch team and replace teamId with team id
		teamID := web.Params(c.Req)[paramName]
		// if teamID is empty or is an integer, we assume it's a team id and we don't need to resolve it
		_, err := strconv.ParseInt(teamID, 10, 64)
		if teamID == "" || err == nil {
			return
		}

		team, err := teamService.GetTeamByID(c.Req.Context(), &GetTeamByIDQuery{UID: teamID, OrgID: c.OrgID})
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[paramName] = strconv.FormatInt(team.ID, 10)
			web.SetURLParams(c.Req, gotParams)
		} else {
			c.JsonApiErr(404, "Not found", nil)
		}
	}
}
