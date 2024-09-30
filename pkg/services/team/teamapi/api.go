package teamapi

import (
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/licensing"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type TeamAPI struct {
	teamService            team.Service
	ac                     accesscontrol.Service
	teamPermissionsService accesscontrol.TeamPermissionsService
	userService            user.Service
	license                licensing.Licensing
	cfg                    *setting.Cfg
	preferenceService      pref.Service
	ds                     dashboards.DashboardService
	logger                 log.Logger
}

func ProvideTeamAPI(
	routeRegister routing.RouteRegister,
	teamService team.Service,
	ac accesscontrol.Service,
	acEvaluator accesscontrol.AccessControl,
	teamPermissionsService accesscontrol.TeamPermissionsService,
	userService user.Service,
	license licensing.Licensing,
	cfg *setting.Cfg,
	preferenceService pref.Service,
	ds dashboards.DashboardService,
) *TeamAPI {
	tapi := &TeamAPI{
		teamService:            teamService,
		ac:                     ac,
		teamPermissionsService: teamPermissionsService,
		userService:            userService,
		license:                license,
		cfg:                    cfg,
		preferenceService:      preferenceService,
		ds:                     ds,
		logger:                 log.New("team-api"),
	}

	tapi.registerRoutes(routeRegister, acEvaluator)
	return tapi
}

func TeamUIDResolver(teamService team.Service) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// Get team id from request, fetch team and replace teamId with team id
		teamID := web.Params(c.Req)[":teamId"]
		// if teamID is empty or is an integer, we assume it's a team id and we don't need to resolve it
		_, err := strconv.ParseInt(teamID, 10, 64)
		if teamID == "" || err == nil {
			return
		}

		team, err := teamService.GetTeamByID(c.Req.Context(), &team.GetTeamByIDQuery{UID: teamID, OrgID: c.OrgID})
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[":teamId"] = strconv.FormatInt(team.ID, 10)
			web.SetURLParams(c.Req, gotParams)
		} else {
			c.JsonApiErr(404, "Not found", nil)
		}
	}
}

func (tapi *TeamAPI) registerRoutes(router routing.RouteRegister, ac accesscontrol.AccessControl) {
	authorize := accesscontrol.Middleware(ac)
	teamResolver := TeamUIDResolver(tapi.teamService)
	router.Group("/api", func(apiRoute routing.RouteRegister) {
		// team (admin permission required)
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Post("/", authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsCreate)),
				routing.Wrap(tapi.createTeam))
			teamsRoute.Put("/:teamId", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.updateTeam))
			teamsRoute.Delete("/:teamId", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsDelete,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.deleteTeamByID))
			teamsRoute.Get("/:teamId/members", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsPermissionsRead,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.getTeamMembers))
			teamsRoute.Post("/:teamId/members", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsPermissionsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.addTeamMember))
			teamsRoute.Put("/:teamId/members/:userId", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsPermissionsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.updateTeamMember))
			teamsRoute.Put("/:teamId/members", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsPermissionsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.setTeamMemberships))
			teamsRoute.Delete("/:teamId/members/:userId", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsPermissionsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.removeTeamMember))
			teamsRoute.Get("/:teamId/preferences", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsRead,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.getTeamPreferences))
			teamsRoute.Put("/:teamId/preferences", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsWrite,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.updateTeamPreferences))
		}, requestmeta.SetOwner(requestmeta.TeamAuth))

		// team without requirement of user to be org admin
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Get("/:teamId", teamResolver, authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsRead,
				accesscontrol.ScopeTeamsID)), routing.Wrap(tapi.getTeamByID))
			teamsRoute.Get("/search", authorize(accesscontrol.EvalPermission(accesscontrol.ActionTeamsRead)),
				routing.Wrap(tapi.searchTeams))
		}, requestmeta.SetOwner(requestmeta.TeamAuth))
	})
}
