package navtreeimpl

import (
	"github.com/grafana/grafana/pkg/login/social"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ssoutils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func (s *ServiceImpl) getAdminNode(c *contextmodel.ReqContext) (*navtree.NavLink, error) {
	var configNodes []*navtree.NavLink
	ctx := c.Req.Context()
	hasAccess := ac.HasAccess(s.accessControl, c)
	hasGlobalAccess := ac.HasGlobalAccess(s.accessControl, s.authnService, c)
	orgsAccessEvaluator := ac.EvalPermission(ac.ActionOrgsRead)
	authConfigUIAvailable := s.license.FeatureEnabled(social.SAMLProviderName) || s.cfg.LDAPAuthEnabled

	// FIXME: If plugin admin is disabled or externally managed, server admins still need to access the page, this is why
	// while we don't have a permissions for listing plugins the legacy check has to stay as a default
	if pluginaccesscontrol.ReqCanAdminPlugins(s.cfg)(c) || hasAccess(pluginaccesscontrol.AdminAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Plugins",
			Id:       "plugins",
			SubTitle: "Extend the Grafana experience with plugins",
			Icon:     "plug",
			Url:      s.cfg.AppSubURL + "/plugins",
		})
	}

	if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionOrgUsersRead), ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll))) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text: "Users", SubTitle: "Manage users in Grafana", Id: "global-users", Url: s.cfg.AppSubURL + "/admin/users", Icon: "user",
		})
	}

	if hasAccess(ac.TeamsAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Teams",
			Id:       "teams",
			SubTitle: "Groups of users that have common dashboard and permission needs",
			Icon:     "users-alt",
			Url:      s.cfg.AppSubURL + "/org/teams",
		})
	}

	if enableServiceAccount(s, c) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Service accounts",
			Id:       "serviceaccounts",
			SubTitle: "Use service accounts to run automated workloads in Grafana",
			Icon:     "gf-service-account",
			Url:      s.cfg.AppSubURL + "/org/serviceaccounts",
		})
	}

	disabled, err := s.apiKeyService.IsDisabled(ctx, c.SignedInUser.GetOrgID())
	if err != nil {
		return nil, err
	}
	if hasAccess(ac.ApiKeyAccessEvaluator) && !disabled {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "API keys",
			Id:       "apikeys",
			SubTitle: "Manage and create API keys that are used to interact with Grafana HTTP APIs",
			Icon:     "key-skeleton-alt",
			Url:      s.cfg.AppSubURL + "/org/apikeys",
		})
	}

	if hasAccess(ac.OrgPreferencesAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Default preferences",
			Id:       "org-settings",
			SubTitle: "Manage preferences across an organization",
			Icon:     "sliders-v-alt",
			Url:      s.cfg.AppSubURL + "/org",
		})
	}

	if authConfigUIAvailable && hasAccess(ssoutils.EvalAuthenticationSettings(s.cfg)) ||
		(hasAccess(ssoutils.OauthSettingsEvaluator(s.cfg)) && s.features.IsEnabled(ctx, featuremgmt.FlagSsoSettingsApi)) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Authentication",
			Id:       "authentication",
			SubTitle: "Manage your auth settings and configure single sign-on",
			Icon:     "signin",
			Url:      s.cfg.AppSubURL + "/admin/authentication",
		})
	}

	if hasAccess(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsAll)) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text: "Settings", SubTitle: "View the settings defined in your Grafana config", Id: "server-settings", Url: s.cfg.AppSubURL + "/admin/settings", Icon: "sliders-v-alt",
		})
	}

	if hasGlobalAccess(orgsAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text: "Organizations", SubTitle: "Isolated instances of Grafana running on the same server", Id: "global-orgs", Url: s.cfg.AppSubURL + "/admin/orgs", Icon: "building",
		})
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagFeatureToggleAdminPage) && hasAccess(ac.EvalPermission(ac.ActionFeatureManagementRead)) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Feature Toggles",
			SubTitle: "View and edit feature toggles",
			Id:       "feature-toggles",
			Url:      s.cfg.AppSubURL + "/admin/featuretoggles",
			Icon:     "toggle-on",
		})
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagCorrelations) && hasAccess(correlations.ConfigurationPageAccess) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:     "Correlations",
			Icon:     "gf-glue",
			SubTitle: "Add and configure correlations",
			Id:       "correlations",
			Url:      s.cfg.AppSubURL + "/datasources/correlations",
		})
	}

	if hasAccess(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsAll)) && s.features.IsEnabled(ctx, featuremgmt.FlagStorage) {
		storage := &navtree.NavLink{
			Text:     "Storage",
			Id:       "storage",
			SubTitle: "Manage file storage",
			Icon:     "cube",
			Url:      s.cfg.AppSubURL + "/admin/storage",
		}
		configNodes = append(configNodes, storage)
	}

	if s.features.IsEnabled(ctx, featuremgmt.FlagOnPremToCloudMigrations) && c.SignedInUser.HasRole(org.RoleAdmin) {
		migrateToCloud := &navtree.NavLink{
			Text:     "Migrate to Grafana Cloud",
			Id:       "migrate-to-cloud",
			SubTitle: "Copy configuration from your self-managed installation to a cloud stack",
			Url:      s.cfg.AppSubURL + "/admin/migrate-to-cloud",
		}
		configNodes = append(configNodes, migrateToCloud)
	}

	configNode := &navtree.NavLink{
		Id:         navtree.NavIDCfg,
		Text:       "Administration",
		SubTitle:   "Organization: " + c.SignedInUser.GetOrgName(),
		Icon:       "cog",
		SortWeight: navtree.WeightConfig,
		Children:   configNodes,
		Url:        "/admin",
	}

	return configNode, nil
}

func enableServiceAccount(s *ServiceImpl, c *contextmodel.ReqContext) bool {
	hasAccess := ac.HasAccess(s.accessControl, c)
	return hasAccess(serviceaccounts.AccessEvaluator)
}
