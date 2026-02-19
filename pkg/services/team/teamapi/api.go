package teamapi

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
	features               featuremgmt.FeatureToggles
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
	features featuremgmt.FeatureToggles,
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
		features:               features,
	}

	tapi.registerRoutes(routeRegister, acEvaluator)
	return tapi
}

func (tapi *TeamAPI) registerRoutes(router routing.RouteRegister, ac accesscontrol.AccessControl) {
	authorize := accesscontrol.Middleware(ac)
	teamResolver := team.MiddlewareTeamUIDResolver(tapi.teamService, ":teamId")
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
