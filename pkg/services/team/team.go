package team

import (
	"context"
	"net/http"
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

func UIDToIDHandler(teamService Service) func(ctx context.Context, orgID int64, resourceID string) (string, error) {
	return func(ctx context.Context, orgID int64, resourceID string) (string, error) {
		// if teamID is empty or is an integer, we assume it's a team id and we don't need to resolve it
		_, err := strconv.ParseInt(resourceID, 10, 64)
		if resourceID == "" || err == nil {
			return resourceID, nil
		}
		team, err := teamService.GetTeamByID(ctx, &GetTeamByIDQuery{UID: resourceID, OrgID: orgID})
		if err != nil {
			return "", err
		}

		return strconv.FormatInt(team.ID, 10), err
	}
}

func MiddlewareTeamUIDResolver(teamService Service, paramName string) web.Handler {
	handler := UIDToIDHandler(teamService)

	return func(c *contextmodel.ReqContext) {
		// Get team id from request, fetch team and replace teamId with team id
		teamID := web.Params(c.Req)[paramName]
		id, err := handler(c.Req.Context(), c.OrgID, teamID)
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[paramName] = id
			web.SetURLParams(c.Req, gotParams)
		} else {
			c.JsonApiErr(http.StatusNotFound, "Not found", nil)
		}
	}
}
