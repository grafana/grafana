package navtreeimpl

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func (s *ServiceImpl) setupConfigNodes(c *models.ReqContext) ([]*navtree.NavLink, error) {
	var configNodes []*navtree.NavLink

	hasAccess := ac.HasAccess(s.accessControl, c)
	if hasAccess(ac.ReqOrgAdmin, datasources.ConfigurationPageAccess) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Data sources",
			Icon:        "database",
			Description: "Add and configure data sources",
			Id:          "datasources",
			Url:         s.cfg.AppSubURL + "/datasources",
		})
	}

	if s.features.IsEnabled(featuremgmt.FlagCorrelations) && hasAccess(ac.ReqOrgAdmin, correlations.ConfigurationPageAccess) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Correlations",
			Icon:        "gf-glue",
			Description: "Add and configure correlations",
			Id:          "correlations",
			Url:         s.cfg.AppSubURL + "/datasources/correlations",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Users",
			Id:          "users",
			Description: "Invite and assign roles to users",
			Icon:        "user",
			Url:         s.cfg.AppSubURL + "/org/users",
		})
	}

	if hasAccess(s.ReqCanAdminTeams, ac.TeamsAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Teams",
			Id:          "teams",
			Description: "Groups of users that have common dashboard and permission needs",
			Icon:        "users-alt",
			Url:         s.cfg.AppSubURL + "/org/teams",
		})
	}

	// FIXME: while we don't have a permissions for listing plugins the legacy check has to stay as a default
	if plugins.ReqCanAdminPlugins(s.cfg)(c) || hasAccess(plugins.ReqCanAdminPlugins(s.cfg), plugins.AdminAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Plugins",
			Id:          "plugins",
			Description: "Extend the Grafana experience with plugins",
			Icon:        "plug",
			Url:         s.cfg.AppSubURL + "/plugins",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, ac.OrgPreferencesAccessEvaluator) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Preferences",
			Id:          "org-settings",
			Description: "Manage preferences across an organization",
			Icon:        "sliders-v-alt",
			Url:         s.cfg.AppSubURL + "/org",
		})
	}

	hideApiKeys, _, _ := s.kvStore.Get(c.Req.Context(), c.OrgID, "serviceaccounts", "hideApiKeys")
	apiKeys, err := s.apiKeyService.GetAllAPIKeys(c.Req.Context(), c.OrgID)
	if err != nil {
		return nil, err
	}

	apiKeysHidden := hideApiKeys == "1" && len(apiKeys) == 0
	if hasAccess(ac.ReqOrgAdmin, ac.ApiKeyAccessEvaluator) && !apiKeysHidden {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "API keys",
			Id:          "apikeys",
			Description: "Manage and create API keys that are used to interact with Grafana HTTP APIs",
			Icon:        "key-skeleton-alt",
			Url:         s.cfg.AppSubURL + "/org/apikeys",
		})
	}

	if enableServiceAccount(s, c) {
		configNodes = append(configNodes, &navtree.NavLink{
			Text:        "Service accounts",
			Id:          "serviceaccounts",
			Description: "Use service accounts to run automated workloads in Grafana",
			Icon:        "gf-service-account",
			Url:         s.cfg.AppSubURL + "/org/serviceaccounts",
		})
	}
	return configNodes, nil
}

func (s *ServiceImpl) ReqCanAdminTeams(c *models.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin || (s.cfg.EditorsCanAdmin && c.OrgRole == org.RoleEditor)
}

func enableServiceAccount(s *ServiceImpl, c *models.ReqContext) bool {
	hasAccess := ac.HasAccess(s.accessControl, c)
	return hasAccess(ac.ReqOrgAdmin, serviceaccounts.AccessEvaluator)
}
