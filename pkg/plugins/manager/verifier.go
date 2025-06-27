package manager

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type PluginVerifier struct {
	dashboardService  dashboards.DashboardService
	dashPluginService dashboards.PluginService
}

var _ plugins.Verifier = (*PluginVerifier)(nil)

func ProvideVerifier(dashboardService dashboards.DashboardService, dashPluginService dashboards.PluginService) plugins.Verifier {
	return &PluginVerifier{
		dashboardService:  dashboardService,
		dashPluginService: dashPluginService,
	}
}

func (p *PluginVerifier) DashboardPanelsUsingPlugin(ctx context.Context, pluginID string) (map[string]map[string]string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user from context: %w", err)
	}

	dashboardPlugins, err := p.dashPluginService.GetDashboardsByPluginID(ctx, &dashboards.GetDashboardsByPluginIDQuery{
		OrgID:    user.GetOrgID(),
		PluginID: pluginID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboards for plugin %s: %w", pluginID, err)
	}

	dashboards, err := p.dashboardService.GetAllDashboardsByOrgId(ctx, user.GetOrgID())
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboards for org %d: %w", user.GetOrgID(), err)
	}

	// merge
	dashboards = append(dashboards, dashboardPlugins...)

	usingPlugin := make(map[string]map[string]string, 0)

	for _, dashboard := range dashboards {
		if dashboard.IsFolder {
			continue
		}

		// Won't work for new dashboard format (V2)
		panels, err := dashboard.Data.Get("panels").Array()
		if err != nil {
			return nil, fmt.Errorf("failed to get panels from dashboard %s: %w", dashboard.UID, err)
		}

		for _, rawPanel := range panels {
			panelData := rawPanel.(map[string]any)
			panelID := strconv.Itoa(int(panelData["id"].(int64)))
			panelTitle := panelData["title"].(string)
			datasourceType := panelData["datasource"].(map[string]any)["type"].(string)

			if datasourceType != pluginID {
				continue
			}

			if len(usingPlugin[dashboard.UID]) == 0 {
				usingPlugin[dashboard.UID] = make(map[string]string)
			}

			if _, exists := usingPlugin[dashboard.UID][panelID]; !exists {
				usingPlugin[dashboard.UID][panelID] = panelTitle
			}
		}
	}

	return usingPlugin, nil
}
