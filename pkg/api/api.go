// Package api Grafana HTTP API.
//
// The Grafana backend exposes an HTTP API, the same API is used by the frontend to do
// everything from saving dashboards, creating users and updating data sources.
//
//	Schemes: http, https
//	BasePath: /api
//	Version: 0.0.1
//	Contact: Grafana Labs<hello@grafana.com> https://grafana.com
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
//	Security:
//	- basic:
//	- api_key:
//
//	SecurityDefinitions:
//	basic:
//	 type: basic
//	api_key:
//	 type: apiKey
//	 name: Authorization
//	 in: header
//
// swagger:meta
package api

import (
	"errors"
	"net/http"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ssoutils"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	publicdashboardsapi "github.com/grafana/grafana/pkg/services/publicdashboards/api"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/api")

// registerRoutes registers all API HTTP routes.
func (hs *HTTPServer) registerRoutes() {
	reqNoAuth := middleware.NoAuth()
	reqSignedIn := middleware.ReqSignedIn
	reqNotSignedIn := middleware.ReqNotSignedIn
	reqSignedInNoAnonymous := middleware.ReqSignedInNoAnonymous
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin
	reqOrgAdmin := middleware.ReqOrgAdmin
	reqRoleForAppRoute := middleware.RoleAppPluginAuth(hs.AccessControl, hs.pluginStore, hs.log)
	reqSnapshotPublicModeOrCreate := middleware.SnapshotPublicModeOrCreate(hs.Cfg, hs.AccessControl)
	reqSnapshotPublicModeOrDelete := middleware.SnapshotPublicModeOrDelete(hs.Cfg, hs.AccessControl)
	redirectFromLegacyPanelEditURL := middleware.RedirectFromLegacyPanelEditURL(hs.Cfg)
	authorize := ac.Middleware(hs.AccessControl)
	authorizeInOrg := ac.AuthorizeInOrgMiddleware(hs.AccessControl, hs.authnService)
	quota := middleware.Quota(hs.QuotaService)
	userUIDResolver := middlewareUserUIDResolver(hs.userService, ":id")

	r := hs.RouteRegister

	// not logged in views
	r.Get("/logout", hs.Logout)
	r.Post("/login", requestmeta.SetOwner(requestmeta.TeamAuth), quota(string(auth.QuotaTargetSrv)), routing.Wrap(hs.LoginPost))
	r.Get("/login/:name", quota(string(auth.QuotaTargetSrv)), hs.OAuthLogin)

	r.Get("/login", hs.LoginView)
	r.Get("/invite/:code", hs.Index)

	// MT-frontend config endpoint.
	// OpenFeature flag evaluation is inside the handler
	r.Get("/bootdata", reqNoAuth, hs.GetBootdata)

	// authed views
	r.Get("/", reqSignedIn, hs.Index)
	r.Get("/profile/", reqSignedInNoAnonymous, hs.Index)
	r.Get("/profile/password", reqSignedInNoAnonymous, hs.Index)
	r.Get("/.well-known/change-password", redirectToChangePassword)
	r.Get("/profile/switch-org/:id", reqSignedInNoAnonymous, hs.ChangeActiveOrgAndRedirectToHome)
	r.Get("/org/", authorize(ac.OrgPreferencesAccessEvaluator), hs.Index)
	r.Get("/org/new", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsCreateAccessEvaluator), hs.Index)
	r.Get("/datasources/", authorize(datasources.ConfigurationPageAccess), hs.Index)
	r.Get("/datasources/new", authorize(datasources.NewPageAccess), hs.Index)
	r.Get("/datasources/edit/*", authorize(datasources.EditPageAccess), hs.Index)
	r.Get("/datasources/correlations", authorize(correlations.ConfigurationPageAccess), hs.Index)
	r.Get("/org/users", authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), hs.Index)
	r.Get("/org/teams", authorize(ac.TeamsAccessEvaluator), hs.Index)
	r.Get("/org/teams/edit/*", authorize(ac.TeamsEditAccessEvaluator), hs.Index)
	r.Get("/org/teams/new", authorize(ac.EvalPermission(ac.ActionTeamsCreate)), hs.Index)
	r.Get("/org/serviceaccounts", authorize(ac.EvalPermission(serviceaccounts.ActionRead)), hs.Index)
	r.Get("/org/serviceaccounts/:serviceAccountId", authorize(ac.EvalPermission(serviceaccounts.ActionRead)), hs.Index)
	r.Get("/org/apikeys/", authorize(ac.EvalPermission(ac.ActionAPIKeyRead)), hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqOrgAdmin, hs.Index)
	r.Get("/admin/settings", authorize(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsAll)), hs.Index)
	r.Get("/admin/users", authorize(ac.EvalAny(ac.EvalPermission(ac.ActionOrgUsersRead), ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll))), hs.Index)
	r.Get("/admin/users/create", authorize(ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/admin/users/edit/:id", authorize(ac.EvalPermission(ac.ActionUsersRead)), hs.Index)
	r.Get("/admin/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsAccessEvaluator), hs.Index)
	r.Get("/admin/orgs/edit/:id", authorizeInOrg(ac.UseGlobalOrg, ac.OrgsAccessEvaluator), hs.Index)
	r.Get("/admin/stats", authorize(ac.EvalPermission(ac.ActionServerStatsRead)), hs.Index)
	r.Get("/admin/provisioning", reqOrgAdmin, hs.Index)
	r.Get("/admin/provisioning/*", reqOrgAdmin, hs.Index)

	if hs.Features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrations) {
		r.Get("/admin/migrate-to-cloud", authorize(cloudmigration.MigrationAssistantAccess), hs.Index)
	}

	// feature toggle admin page
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagFeatureToggleAdminPage) {
		r.Get("/admin/featuretoggles", authorize(ac.EvalPermission(ac.ActionFeatureManagementRead)), hs.Index)
	}

	r.Get("/styleguide", reqSignedIn, hs.Index)

	r.Get("/live", reqGrafanaAdmin, hs.Index)
	r.Get("/live/pipeline", reqGrafanaAdmin, hs.Index)
	r.Get("/live/cloud", reqGrafanaAdmin, hs.Index)

	r.Get("/plugins", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index)
	r.Get("/plugins/:id/", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index)
	r.Get("/plugins/:id/edit", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index) // deprecated
	r.Get("/plugins/:id/page/:page", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index)

	r.Get("/connections/datasources", authorize(datasources.ConfigurationPageAccess), hs.Index)
	r.Get("/connections/datasources/new", authorize(datasources.NewPageAccess), hs.Index)
	r.Get("/connections/datasources/edit/*", authorize(datasources.EditPageAccess), hs.Index)
	r.Get("/connections", authorize(datasources.ConfigurationPageAccess), hs.Index)
	r.Get("/connections/add-new-connection", authorize(datasources.ConfigurationPageAccess), hs.Index)
	// Plugin details pages
	r.Get("/connections/datasources/:id", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index)
	r.Get("/connections/datasources/:id/page/:page", middleware.CanAdminPlugins(hs.Cfg, hs.AccessControl), hs.Index)

	// App Root Page
	appPluginIDScope := pluginaccesscontrol.ScopeProvider.GetResourceScope(ac.Parameter(":id"))
	r.Get("/a/:id/*", authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, appPluginIDScope)), reqSignedIn, reqRoleForAppRoute, hs.Index)
	r.Get("/a/:id", authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, appPluginIDScope)), reqSignedIn, reqRoleForAppRoute, hs.Index)

	r.Get("/d/:uid/:slug", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/d/:uid", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/dashboard/script/*", reqSignedIn, hs.Index)
	r.Get("/dashboard/new", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/snapshot/*", hs.Index)
	r.Get("/dashboard/provisioning/*", reqSignedIn, hs.Index)
	r.Get("/d-solo/:uid/:slug", reqSignedIn, hs.Index)
	r.Get("/d-solo/:uid", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/script/*", reqSignedIn, hs.Index)
	r.Get("/import/dashboard", reqSignedIn, hs.Index)
	r.Get("/dashboards/", reqSignedIn, hs.Index)
	r.Get("/dashboards/*", reqSignedIn, hs.Index)

	if hs.Cfg.PublicDashboardsEnabled {
		// list public dashboards
		r.Get("/public-dashboards/list", reqSignedIn, hs.Index)

		// anonymous view public dashboard
		r.Get("/public-dashboards/:accessToken",
			hs.PublicDashboardsApi.Middleware.HandleView,
			publicdashboardsapi.SetPublicDashboardAccessToken,
			publicdashboardsapi.SetPublicDashboardOrgIdOnContext(hs.PublicDashboardsApi.PublicDashboardService),
			publicdashboardsapi.CountPublicDashboardRequest(),
			hs.Index,
		)
	}

	r.Get("/explore", authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), hs.Index)
	r.Get("/drilldown", authorize(ac.EvalPermission(ac.ActionDatasourcesExplore)), hs.Index)

	r.Get("/playlists/", reqSignedIn, hs.Index)
	r.Get("/playlists/*", reqSignedIn, hs.Index)
	r.Get("/alerting/", reqSignedIn, hs.Index)
	r.Get("/alerting/*", reqSignedIn, hs.Index)
	r.Get("/library-panels/", reqSignedIn, hs.Index)
	r.Get("/monitoring/", reqSignedIn, hs.Index)
	r.Get("/monitoring/*", reqSignedIn, hs.Index)
	r.Get("/observability/", reqSignedIn, hs.Index)
	r.Get("/observability/*", reqSignedIn, hs.Index)
	r.Get("/alerts-and-incidents", reqSignedIn, hs.Index)
	r.Get("/alerts-and-incidents/*", reqSignedIn, hs.Index)

	// sign up
	r.Get("/verify", hs.Index)
	r.Get("/signup", hs.Index)
	r.Get("/api/user/signup/options", routing.Wrap(hs.GetSignUpOptions))
	r.Post("/api/user/signup", quota(user.QuotaTargetSrv), quota(org.QuotaTargetSrv), routing.Wrap(hs.SignUp))
	r.Post("/api/user/signup/step2", routing.Wrap(hs.SignUpStep2))

	// update user email
	if hs.Cfg.Smtp.Enabled && hs.Cfg.VerifyEmailEnabled {
		r.Get("/user/email/update", reqSignedInNoAnonymous, routing.Wrap(hs.UpdateUserEmail))
		r.Post("/api/user/email/start-verify", reqSignedInNoAnonymous, routing.Wrap(hs.StartEmailVerificaton))
	}

	if hs.Cfg.PasswordlessMagicLinkAuth.Enabled && hs.Features.IsEnabledGlobally(featuremgmt.FlagPasswordlessMagicLinkAuthentication) {
		r.Post("/api/login/passwordless/start", requestmeta.SetOwner(requestmeta.TeamAuth), quota(string(auth.QuotaTargetSrv)), hs.StartPasswordless)
		r.Post("/api/login/passwordless/authenticate", requestmeta.SetOwner(requestmeta.TeamAuth), quota(string(auth.QuotaTargetSrv)), routing.Wrap(hs.LoginPasswordless))
	}

	// invited
	r.Get("/api/user/invite/:code", routing.Wrap(hs.GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", routing.Wrap(hs.CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", reqNotSignedIn, hs.Index)
	r.Get("/user/password/reset", hs.Index)

	r.Post("/api/user/password/send-reset-email", routing.Wrap(hs.SendResetPasswordEmail))
	r.Post("/api/user/password/reset", routing.Wrap(hs.ResetPassword))

	// dashboard snapshots
	r.Get("/dashboard/snapshot/*", reqNoAuth, hs.Index)
	r.Get("/dashboard/snapshots/", reqSignedIn, hs.Index)

	// api renew session based on cookie
	r.Get("/api/login/ping", quota(string(auth.QuotaTargetSrv)), routing.Wrap(hs.LoginAPIPing))

	// expose plugin file system assets
	r.Get("/public/plugins/:pluginId/*", hs.getPluginAssets)

	// add swagger support
	hs.registerSwaggerUI(r)

	r.Post("/api/user/auth-tokens/rotate", routing.Wrap(hs.RotateUserAuthToken))
	r.Get("/user/auth-tokens/rotate", routing.Wrap(hs.RotateUserAuthTokenRedirect))

	adminAuthPageEvaluator := func() ac.Evaluator {
		authnSettingsEval := ssoutils.EvalAuthenticationSettings(hs.Cfg)

		return ac.EvalAny(authnSettingsEval, ssoutils.OauthSettingsEvaluator(hs.Cfg))
	}

	r.Get("/admin/authentication", authorize(adminAuthPageEvaluator()), hs.Index)
	r.Get("/admin/authentication/ldap", authorize(ac.EvalPermission(ac.ActionLDAPStatusRead)), hs.Index)

	providerParam := ac.Parameter(":provider")
	r.Get("/admin/authentication/:provider", authorize(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsOAuth(providerParam))), hs.Index)

	// ShortURL API
	hs.registerShortURLAPI(r)

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {
		// user (signed in)
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/", routing.Wrap(hs.GetSignedInUser))
			userRoute.Put("/", routing.Wrap(hs.UpdateSignedInUser))
			userRoute.Post("/using/:id", routing.Wrap(hs.UserSetUsingOrg))
			userRoute.Get("/orgs", routing.Wrap(hs.GetSignedInUserOrgList))
			userRoute.Get("/teams", routing.Wrap(hs.GetSignedInUserTeamList))

			userRoute.Get("/stars", routing.Wrap(hs.starApi.GetStars))
			userRoute.Post("/stars/dashboard/uid/:uid", routing.Wrap(hs.starApi.StarDashboardByUID))
			userRoute.Delete("/stars/dashboard/uid/:uid", routing.Wrap(hs.starApi.UnstarDashboardByUID))

			userRoute.Put("/password", routing.Wrap(hs.ChangeUserPassword))
			userRoute.Get("/quotas", routing.Wrap(hs.GetUserQuotas))
			userRoute.Put("/helpflags/:id", routing.Wrap(hs.SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", routing.Wrap(hs.ClearHelpFlags))

			userRoute.Get("/preferences", routing.Wrap(hs.GetUserPreferences))
			userRoute.Put("/preferences", routing.Wrap(hs.UpdateUserPreferences))
			userRoute.Patch("/preferences", routing.Wrap(hs.PatchUserPreferences))

			userRoute.Get("/auth-tokens", requestmeta.SetOwner(requestmeta.TeamAuth), routing.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", requestmeta.SetOwner(requestmeta.TeamAuth), routing.Wrap(hs.RevokeUserAuthToken))
		}, reqSignedInNoAnonymous)

		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			userIDScope := ac.Scope("global.users", "id", ac.Parameter(":id"))
			usersRoute.Get("/", authorize(ac.EvalPermission(ac.ActionUsersRead)), routing.Wrap(hs.searchUsersService.SearchUsers))
			usersRoute.Get("/search", authorize(ac.EvalPermission(ac.ActionUsersRead)), routing.Wrap(hs.searchUsersService.SearchUsersWithPaging))
			usersRoute.Get("/:id", userUIDResolver, authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserByID))
			usersRoute.Get("/:id/teams", userUIDResolver, authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserTeams))
			usersRoute.Get("/:id/orgs", userUIDResolver, authorize(ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", authorize(ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.GetUserByLoginOrEmail))
			usersRoute.Put("/:id", userUIDResolver, authorize(ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUser))
			usersRoute.Post("/:id/using/:orgId", userUIDResolver, authorize(ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUserActiveOrg))
		}, requestmeta.SetOwner(requestmeta.TeamAuth))

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/", authorize(ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetCurrentOrg))
			orgRoute.Get("/quotas", authorize(ac.EvalPermission(ac.ActionOrgsQuotasRead)), routing.Wrap(hs.GetCurrentOrgQuotas))
		})

		if hs.Features.IsEnabledGlobally(featuremgmt.FlagStorage) {
			// Will eventually be replaced with the 'object' route
			apiRoute.Group("/storage", hs.StorageService.RegisterHTTPRoutes)
		}

		if hs.Features.IsEnabledGlobally(featuremgmt.FlagPanelTitleSearch) {
			apiRoute.Group("/search-v2", hs.SearchV2HTTPService.RegisterHTTPRoutes)
		}

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgRoute.Put("/", authorize(ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrg))
			orgRoute.Put("/address", authorize(ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrgAddress))
			orgRoute.Get("/users", requestmeta.SetOwner(requestmeta.TeamAuth), authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Get("/users/search", requestmeta.SetOwner(requestmeta.TeamAuth), authorize(ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.SearchOrgUsersWithPaging))
			orgRoute.Post("/users", requestmeta.SetOwner(requestmeta.TeamAuth), authorize(ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), quota(user.QuotaTargetSrv), quota(org.QuotaTargetSrv), routing.Wrap(hs.AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", requestmeta.SetOwner(requestmeta.TeamAuth), authorize(ac.EvalPermission(ac.ActionOrgUsersWrite, userIDScope)), routing.Wrap(hs.UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", requestmeta.SetOwner(requestmeta.TeamAuth), authorize(ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), routing.Wrap(hs.GetPendingOrgInvites))
			orgRoute.Post("/invites", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), quota(user.QuotaTargetSrv), quota(user.QuotaTargetSrv), routing.Wrap(hs.AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", authorize(ac.EvalPermission(ac.ActionOrgUsersAdd)), routing.Wrap(hs.RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesRead)), routing.Wrap(hs.GetOrgPreferences))
			orgRoute.Put("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesWrite)), routing.Wrap(hs.UpdateOrgPreferences))
			orgRoute.Patch("/preferences", authorize(ac.EvalPermission(ac.ActionOrgsPreferencesWrite)), routing.Wrap(hs.PatchOrgPreferences))
		})

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			lookupEvaluator := func() ac.Evaluator {
				if hs.License.FeatureEnabled("accesscontrol.enforcement") {
					return ac.EvalPermission(ac.ActionOrgUsersRead)
				}
				// For oss we allow users with access to update permissions on either folders, teams or dashboards to perform the lookup
				return ac.EvalAny(
					ac.EvalPermission(ac.ActionOrgUsersRead),
					ac.EvalPermission(ac.ActionTeamsPermissionsWrite),
					ac.EvalPermission(dashboards.ActionFoldersPermissionsWrite),
					ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite),
				)
			}
			orgRoute.Get("/users/lookup", authorize(lookupEvaluator()), routing.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsCreate)), quota(org.QuotaTargetSrv), routing.Wrap(hs.CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.SearchOrgs))

		orgUserUIDResolver := middlewareUserUIDResolver(hs.userService, ":userId")
		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgsRoute.Get("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetOrgByID))
			orgsRoute.Put("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateOrg))
			orgsRoute.Put("/address", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsWrite)), routing.Wrap(hs.UpdateOrgAddress))
			orgsRoute.Delete("/", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsDelete)), routing.Wrap(hs.DeleteOrgByID))
			orgsRoute.Get("/users", requestmeta.SetOwner(requestmeta.TeamAuth), authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsers))
			orgsRoute.Get("/users/search", requestmeta.SetOwner(requestmeta.TeamAuth), authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.SearchOrgUsers))
			orgsRoute.Post("/users", requestmeta.SetOwner(requestmeta.TeamAuth), authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), routing.Wrap(hs.AddOrgUser))
			orgsRoute.Patch("/users/:userId", orgUserUIDResolver, requestmeta.SetOwner(requestmeta.TeamAuth), authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersWrite, userIDScope)), routing.Wrap(hs.UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", orgUserUIDResolver, requestmeta.SetOwner(requestmeta.TeamAuth), authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUser))
			orgsRoute.Get("/quotas", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsQuotasRead)), routing.Wrap(hs.GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", authorizeInOrg(ac.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgsQuotasWrite)), routing.Wrap(hs.UpdateOrgQuota))
		})

		// orgs (admin routes)
		apiRoute.Get("/orgs/name/:name/", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionOrgsRead)), routing.Wrap(hs.GetOrgByName))

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", routing.Wrap(hs.SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute routing.RouteRegister) {
			idScope := datasources.ScopeProvider.GetResourceScope(ac.Parameter(":id"))
			uidScope := datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":uid"))
			nameScope := datasources.ScopeProvider.GetResourceScopeName(ac.Parameter(":name"))
			datasourceRoute.Get("/", authorize(ac.EvalPermission(datasources.ActionRead)), routing.Wrap(hs.GetDataSources))
			datasourceRoute.Post("/", authorize(ac.EvalPermission(datasources.ActionCreate)), quota(string(datasources.QuotaTargetSrv)), routing.Wrap(hs.AddDataSource))
			datasourceRoute.Put("/:id", authorize(ac.EvalPermission(datasources.ActionWrite, idScope)), routing.Wrap(hs.UpdateDataSourceByID))
			datasourceRoute.Put("/uid/:uid", authorize(ac.EvalPermission(datasources.ActionWrite, uidScope)), routing.Wrap(hs.UpdateDataSourceByUID))
			datasourceRoute.Delete("/:id", authorize(ac.EvalPermission(datasources.ActionDelete, idScope)), routing.Wrap(hs.DeleteDataSourceById))
			datasourceRoute.Delete("/uid/:uid", authorize(ac.EvalPermission(datasources.ActionDelete, uidScope)), routing.Wrap(hs.DeleteDataSourceByUID))
			datasourceRoute.Delete("/name/:name", authorize(ac.EvalPermission(datasources.ActionDelete, nameScope)), routing.Wrap(hs.DeleteDataSourceByName))
			datasourceRoute.Get("/:id", authorize(ac.EvalPermission(datasources.ActionRead, idScope)), routing.Wrap(hs.GetDataSourceById))
			datasourceRoute.Get("/uid/:uid", authorize(ac.EvalPermission(datasources.ActionRead, uidScope)), routing.Wrap(hs.GetDataSourceByUID))
			datasourceRoute.Get("/name/:name", authorize(ac.EvalPermission(datasources.ActionRead, nameScope)), routing.Wrap(hs.GetDataSourceByName))
			datasourceRoute.Get("/id/:name", authorize(ac.EvalPermission(datasources.ActionIDRead, nameScope)), routing.Wrap(hs.GetDataSourceIdByName))
		})

		pluginIDScope := pluginaccesscontrol.ScopeProvider.GetResourceScope(ac.Parameter(":pluginId"))
		apiRoute.Get("/plugins", routing.Wrap(hs.GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", routing.Wrap(hs.GetPluginSettingByID)) // RBAC check performed in handler for App Plugins
		apiRoute.Get("/plugins/:pluginId/markdown/:name", routing.Wrap(hs.GetPluginMarkdown))
		apiRoute.Get("/plugins/:pluginId/health", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), checkAppEnabled(hs.pluginStore, hs.PluginSettings), routing.Wrap(hs.CheckHealth))
		apiRoute.Any("/plugins/:pluginId/resources", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginIDScope)), checkAppEnabled(hs.pluginStore, hs.PluginSettings), hs.CallResource)
		apiRoute.Any("/plugins/:pluginId/resources/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginIDScope)), checkAppEnabled(hs.pluginStore, hs.PluginSettings), hs.CallResource)
		apiRoute.Get("/plugins/errors", routing.Wrap(hs.GetPluginErrorsList))
		apiRoute.Any("/plugin-proxy/:pluginId/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginIDScope)), checkAppEnabled(hs.pluginStore, hs.PluginSettings), hs.ProxyPluginRequest)
		apiRoute.Any("/plugin-proxy/:pluginId", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginIDScope)), checkAppEnabled(hs.pluginStore, hs.PluginSettings), hs.ProxyPluginRequest)

		if hs.Cfg.PluginAdminEnabled {
			apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
				pluginRoute.Post("/:pluginId/install", authorizeInOrg(ac.UseGlobalOrSingleOrg(hs.Cfg), ac.EvalPermission(pluginaccesscontrol.ActionInstall)), routing.Wrap(hs.InstallPlugin))
				pluginRoute.Post("/:pluginId/uninstall", authorizeInOrg(ac.UseGlobalOrSingleOrg(hs.Cfg), ac.EvalPermission(pluginaccesscontrol.ActionInstall)), routing.Wrap(hs.UninstallPlugin))
			})
		}

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", reqOrgAdmin, checkAppEnabled(hs.pluginStore, hs.PluginSettings), routing.Wrap(hs.GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", authorize(ac.EvalPermission(pluginaccesscontrol.ActionWrite, pluginIDScope)), routing.Wrap(hs.UpdatePluginSetting))
			pluginRoute.Get("/:pluginId/metrics", reqOrgAdmin, routing.Wrap(hs.CollectPluginMetrics))
		})

		apiRoute.Get("/frontend/settings/", hs.GetFrontendSettings)
		apiRoute.Get("/frontend/assets", hs.GetFrontendAssets)

		apiRoute.Any("/datasources/proxy/:id/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/uid/:uid/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.ProxyDataSourceRequestWithUID)
		apiRoute.Any("/datasources/proxy/:id", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/uid/:uid", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.ProxyDataSourceRequestWithUID)
		// Deprecated: use /datasources/uid/:uid/resources API instead.
		apiRoute.Any("/datasources/:id/resources", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.CallDatasourceResource)
		apiRoute.Any("/datasources/uid/:uid/resources", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.CallDatasourceResourceWithUID)
		// Deprecated: use /datasources/uid/:uid/resources/* API instead.
		apiRoute.Any("/datasources/:id/resources/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.CallDatasourceResource)
		apiRoute.Any("/datasources/uid/:uid/resources/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.CallDatasourceResourceWithUID)
		// Deprecated: use /datasources/uid/:uid/health API instead.
		apiRoute.Any("/datasources/:id/health", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), routing.Wrap(hs.CheckDatasourceHealth))
		apiRoute.Any("/datasources/uid/:uid/health", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), routing.Wrap(hs.CheckDatasourceHealthWithUID))

		// Folders
		hs.registerFolderAPI(apiRoute, authorize)

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute routing.RouteRegister) {
			dashUIDScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(ac.Parameter(":uid"))

			dashboardRoute.Get("/uid/:uid", authorize(ac.EvalPermission(dashboards.ActionDashboardsRead, dashUIDScope)), routing.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/uid/:uid", authorize(ac.EvalPermission(dashboards.ActionDashboardsDelete, dashUIDScope)), routing.Wrap(hs.DeleteDashboardByUID))

			dashboardRoute.Group("/uid/:uid", func(dashUidRoute routing.RouteRegister) {
				dashUidRoute.Get("/versions", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashUIDScope)), routing.Wrap(hs.GetDashboardVersions))
				dashUidRoute.Post("/restore", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashUIDScope)), routing.Wrap(hs.RestoreDashboardVersion))
				dashUidRoute.Get("/versions/:id", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashUIDScope)), routing.Wrap(hs.GetDashboardVersion))

				dashUidRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsRead)), routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite)), routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})

			dashboardRoute.Post("/calculate-diff", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite)), routing.Wrap(hs.CalculateDashboardDiff))

			dashboardRoute.Post("/db", authorize(ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionDashboardsWrite))), routing.Wrap(hs.PostDashboard))
			dashboardRoute.Get("/home", routing.Wrap(hs.GetHomeDashboard))
			dashboardRoute.Get("/tags", hs.GetDashboardTags)

			// Deprecated: used to convert internal IDs to UIDs
			dashboardRoute.Get("/ids/:ids", authorize(ac.EvalPermission(dashboards.ActionDashboardsRead)), hs.GetDashboardUIDs)

			// Deprecated: use /uid/:uid API instead.
			dashboardRoute.Group("/id/:dashboardId", func(dashIdRoute routing.RouteRegister) {
				dashIDScope := dashboards.ScopeDashboardsProvider.GetResourceScope(ac.Parameter(":dashboardId"))
				dashIdRoute.Get("/versions", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashIDScope)), routing.Wrap(hs.GetDashboardVersions))
				dashIdRoute.Get("/versions/:id", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashIDScope)), routing.Wrap(hs.GetDashboardVersion))
				dashIdRoute.Post("/restore", authorize(ac.EvalPermission(dashboards.ActionDashboardsWrite, dashIDScope)), routing.Wrap(hs.RestoreDashboardVersion))

				dashIdRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsRead)), routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", authorize(ac.EvalPermission(dashboards.ActionDashboardsPermissionsWrite)), routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})
		})

		// Dashboard snapshots
		apiRoute.Group("/dashboard/snapshots", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/", authorize(ac.EvalPermission(dashboards.ActionSnapshotsRead)), routing.Wrap(hs.SearchDashboardSnapshots))
		})

		// Playlist
		hs.registerPlaylistAPI(apiRoute)

		// Search
		apiRoute.Get("/search/sorting", routing.Wrap(hs.ListSortOptions))
		apiRoute.Get("/search/", routing.Wrap(hs.Search))

		// metrics
		// DataSource w/ expressions
		apiRoute.Post("/ds/query", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), authorize(ac.EvalPermission(datasources.ActionQuery)), hs.getDSQueryEndpoint())

		// Unified Alerting
		apiRoute.Get("/alert-notifiers", reqSignedIn, requestmeta.SetOwner(requestmeta.TeamAlerting), routing.Wrap(
			hs.GetAlertNotifiers()),
		)

		apiRoute.Get("/annotations", authorize(ac.EvalPermission(ac.ActionAnnotationsRead)), routing.Wrap(hs.GetAnnotations))
		apiRoute.Post("/annotations/mass-delete", authorize(ac.EvalPermission(ac.ActionAnnotationsDelete)), routing.Wrap(hs.MassDeleteAnnotations))

		apiRoute.Group("/annotations", func(annotationsRoute routing.RouteRegister) {
			annotationsRoute.Post("/", authorize(ac.EvalPermission(ac.ActionAnnotationsCreate)), routing.Wrap(hs.PostAnnotation))
			annotationsRoute.Get("/:annotationId", authorize(ac.EvalPermission(ac.ActionAnnotationsRead, ac.ScopeAnnotationsID)), routing.Wrap(hs.GetAnnotationByID))
			annotationsRoute.Delete("/:annotationId", authorize(ac.EvalPermission(ac.ActionAnnotationsDelete, ac.ScopeAnnotationsID)), routing.Wrap(hs.DeleteAnnotationByID))
			annotationsRoute.Put("/:annotationId", authorize(ac.EvalPermission(ac.ActionAnnotationsWrite, ac.ScopeAnnotationsID)), routing.Wrap(hs.UpdateAnnotation))
			annotationsRoute.Patch("/:annotationId", authorize(ac.EvalPermission(ac.ActionAnnotationsWrite, ac.ScopeAnnotationsID)), routing.Wrap(hs.PatchAnnotation))
			annotationsRoute.Post("/graphite", authorize(ac.EvalPermission(ac.ActionAnnotationsCreate, ac.ScopeAnnotationsTypeOrganization)), routing.Wrap(hs.PostGraphiteAnnotation))
			annotationsRoute.Get("/tags", authorize(ac.EvalPermission(ac.ActionAnnotationsRead)), routing.Wrap(hs.GetAnnotationTags))
		})

		apiRoute.Post("/frontend-metrics", routing.Wrap(hs.PostFrontendMetrics))

		apiRoute.Group("/live", func(liveRoute routing.RouteRegister) {
			// the channel path is in the name
			liveRoute.Post("/publish", routing.Wrap(hs.Live.HandleHTTPPublish))

			// POST influx line protocol.
			liveRoute.Post("/push/:streamId", hs.LivePushGateway.Handle)

			// List available streams and fields
			liveRoute.Get("/list", routing.Wrap(hs.Live.HandleListHTTP))

			// Some channels may have info
			liveRoute.Get("/info/*", routing.Wrap(hs.Live.HandleInfoHTTP))
		}, requestmeta.SetSLOGroup(requestmeta.SLOGroupNone))
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		// There is additional filter which will ensure that user sees only settings that they are allowed to see, so we don't need provide additional scope here for ActionSettingsRead.
		adminRoute.Get("/settings", authorize(ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(hs.AdminGetSettings))
		adminRoute.Get("/settings-verbose", authorize(ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(hs.AdminGetVerboseSettings))
		adminRoute.Get("/stats", authorize(ac.EvalPermission(ac.ActionServerStatsRead)), routing.Wrap(hs.AdminGetStats))

		adminRoute.Post("/encryption/rotate-data-keys", reqGrafanaAdmin, routing.Wrap(hs.AdminRotateDataEncryptionKeys))
		adminRoute.Post("/encryption/reencrypt-data-keys", reqGrafanaAdmin, routing.Wrap(hs.AdminReEncryptEncryptionKeys))
		adminRoute.Post("/encryption/reencrypt-secrets", reqGrafanaAdmin, routing.Wrap(hs.AdminReEncryptSecrets))
		adminRoute.Post("/encryption/rollback-secrets", reqGrafanaAdmin, routing.Wrap(hs.AdminRollbackSecrets))

		adminRoute.Post("/provisioning/dashboards/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersDashboards)), routing.Wrap(hs.AdminProvisioningReloadDashboards))
		adminRoute.Post("/provisioning/plugins/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersPlugins)), routing.Wrap(hs.AdminProvisioningReloadPlugins))
		adminRoute.Post("/provisioning/datasources/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersDatasources)), routing.Wrap(hs.AdminProvisioningReloadDatasources))
		adminRoute.Post("/provisioning/alerting/reload", authorize(ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersAlertRules)), routing.Wrap(hs.AdminProvisioningReloadAlerting))
	}, reqSignedIn)

	// Administering users
	r.Group("/api/admin/users", func(adminUserRoute routing.RouteRegister) {
		userIDScope := ac.Scope("global.users", "id", ac.Parameter(":id"))

		adminUserRoute.Post("/", authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(hs.AdminCreateUser))
		adminUserRoute.Put("/:id/password", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersPasswordUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPassword))
		adminUserRoute.Put("/:id/permissions", userUIDResolver, reqGrafanaAdmin, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersPermissionsUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPermissions))
		adminUserRoute.Delete("/:id", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersDelete, userIDScope)), routing.Wrap(hs.AdminDeleteUser))
		adminUserRoute.Post("/:id/disable", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersDisable, userIDScope)), routing.Wrap(hs.AdminDisableUser))
		adminUserRoute.Post("/:id/enable", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersEnable, userIDScope)), routing.Wrap(hs.AdminEnableUser))
		adminUserRoute.Get("/:id/quotas", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersQuotasList, userIDScope)), routing.Wrap(hs.GetUserQuotas))
		adminUserRoute.Put("/:id/quotas/:target", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersQuotasUpdate, userIDScope)), routing.Wrap(hs.UpdateUserQuota))

		adminUserRoute.Post("/:id/logout", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersLogout, userIDScope)), routing.Wrap(hs.AdminLogoutUser))
		adminUserRoute.Get("/:id/auth-tokens", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersAuthTokenList, userIDScope)), routing.Wrap(hs.AdminGetUserAuthTokens))
		adminUserRoute.Post("/:id/revoke-auth-token", userUIDResolver, authorizeInOrg(ac.UseGlobalOrg, ac.EvalPermission(ac.ActionUsersAuthTokenUpdate, userIDScope)), routing.Wrap(hs.AdminRevokeUserAuthToken))
	}, reqSignedIn)

	// rendering
	r.Get("/render/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), reqSignedIn, hs.RenderHandler)

	// grafana.net proxy
	r.Any("/api/gnet/*", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), reqSignedIn, hs.ProxyGnetRequest)

	// Gravatar service
	r.Get("/avatar/:hash", requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow), hs.AvatarCacheServer.Handler)

	// Snapshots
	r.Get("/api/snapshot/shared-options/", reqSignedIn, hs.GetSharingOptions)

	r.Post("/api/snapshots/", reqSnapshotPublicModeOrCreate, hs.getCreatedSnapshotHandler())
	r.Get("/api/snapshots/:key", routing.Wrap(hs.GetDashboardSnapshot))
	r.Delete("/api/snapshots/:key", authorize(ac.EvalPermission(dashboards.ActionSnapshotsDelete)), routing.Wrap(hs.DeleteDashboardSnapshot))

	// Snapshots delete for public mode or using the deleteKey
	r.Get("/api/snapshots-delete/:deleteKey", reqSnapshotPublicModeOrDelete, routing.Wrap(hs.DeleteDashboardSnapshotByDeleteKey))
}

func middlewareUserUIDResolver(userService user.Service, paramName string) web.Handler {
	handler := user.UIDToIDHandler(userService)

	return func(c *contextmodel.ReqContext) {
		userID := web.Params(c.Req)[paramName]
		id, err := handler(c.Req.Context(), userID)
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[paramName] = id
			web.SetURLParams(c.Req, gotParams)
		} else {
			if errors.Is(err, user.ErrUserNotFound) {
				c.JsonApiErr(http.StatusNotFound, "User not found", nil)
			} else {
				c.JsonApiErr(http.StatusInternalServerError, "Failed to resolve user", err)
			}
		}
	}
}
