package navtree

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func (hs *ServiceImpl) setupConfigNodes(c *models.ReqContext) ([]*dtos.NavLink, error) {
	var configNodes []*dtos.NavLink

	hasAccess := ac.HasAccess(hs.accessControl, c)
	if hasAccess(ac.ReqOrgAdmin, datasources.ConfigurationPageAccess) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Data sources",
			Icon:        "database",
			Description: "Add and configure data sources",
			Id:          "datasources",
			Url:         hs.cfg.AppSubURL + "/datasources",
		})
	}

	if hs.features.IsEnabled(featuremgmt.FlagCorrelations) && hasAccess(ac.ReqOrgAdmin, correlations.ConfigurationPageAccess) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Correlations",
			Icon:        "gf-glue",
			Description: "Add and configure correlations",
			Id:          "correlations",
			Url:         hs.cfg.AppSubURL + "/datasources/correlations",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Users",
			Id:          "users",
			Description: "Manage org members",
			Icon:        "user",
			Url:         hs.cfg.AppSubURL + "/org/users",
		})
	}

	if hasAccess(hs.ReqCanAdminTeams, ac.TeamsAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Teams",
			Id:          "teams",
			Description: "Manage org groups",
			Icon:        "users-alt",
			Url:         hs.cfg.AppSubURL + "/org/teams",
		})
	}

	// FIXME: while we don't have a permissions for listing plugins the legacy check has to stay as a default
	if plugins.ReqCanAdminPlugins(hs.cfg)(c) || hasAccess(plugins.ReqCanAdminPlugins(hs.cfg), plugins.AdminAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Plugins",
			Id:          "plugins",
			Description: "View and configure plugins",
			Icon:        "plug",
			Url:         hs.cfg.AppSubURL + "/plugins",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, ac.OrgPreferencesAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Preferences",
			Id:          "org-settings",
			Description: "Organization preferences",
			Icon:        "sliders-v-alt",
			Url:         hs.cfg.AppSubURL + "/org",
		})
	}

	hideApiKeys, _, _ := hs.kvStore.Get(c.Req.Context(), c.OrgID, "serviceaccounts", "hideApiKeys")
	apiKeys, err := hs.apiKeyService.GetAllAPIKeys(c.Req.Context(), c.OrgID)
	if err != nil {
		return nil, err
	}

	apiKeysHidden := hideApiKeys == "1" && len(apiKeys) == 0
	if hasAccess(ac.ReqOrgAdmin, ac.ApiKeyAccessEvaluator) && !apiKeysHidden {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "API keys",
			Id:          "apikeys",
			Description: "Create & manage API keys",
			Icon:        "key-skeleton-alt",
			Url:         hs.cfg.AppSubURL + "/org/apikeys",
		})
	}

	if enableServiceAccount(hs, c) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Service accounts",
			Id:          "serviceaccounts",
			Description: "Manage service accounts",
			Icon:        "gf-service-account",
			Url:         hs.cfg.AppSubURL + "/org/serviceaccounts",
		})
	}
	return configNodes, nil
}

func (hs *ServiceImpl) ReqCanAdminTeams(c *models.ReqContext) bool {
	return c.OrgRole == org.RoleAdmin || (hs.cfg.EditorsCanAdmin && c.OrgRole == org.RoleEditor)
}

func enableServiceAccount(hs *ServiceImpl, c *models.ReqContext) bool {
	hasAccess := ac.HasAccess(hs.accessControl, c)
	return hasAccess(ac.ReqOrgAdmin, serviceaccounts.AccessEvaluator)
}
