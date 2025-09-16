package service

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func ProvideDashboardUpdater(bus bus.Bus, pluginStore pluginstore.Store, pluginDashboardService plugindashboards.Service,
	dashboardImportService dashboardimport.Service, pluginSettingsService pluginsettings.Service,
	dashboardPluginService dashboards.PluginService, dashboardService dashboards.DashboardService) *DashboardUpdater {
	du := newDashboardUpdater(bus, pluginStore, pluginDashboardService, dashboardImportService,
		pluginSettingsService, dashboardPluginService, dashboardService)
	return du
}

func newDashboardUpdater(bus bus.Bus, pluginStore pluginstore.Store,
	pluginDashboardService plugindashboards.Service, dashboardImportService dashboardimport.Service,
	pluginSettingsService pluginsettings.Service, dashboardPluginService dashboards.PluginService,
	dashboardService dashboards.DashboardService) *DashboardUpdater {
	s := &DashboardUpdater{
		pluginStore:            pluginStore,
		pluginDashboardService: pluginDashboardService,
		dashboardImportService: dashboardImportService,
		pluginSettingsService:  pluginSettingsService,
		dashboardPluginService: dashboardPluginService,
		dashboardService:       dashboardService,
		logger:                 log.New("plugindashboards"),
	}
	bus.AddEventListener(s.handlePluginStateChanged)

	return s
}

type DashboardUpdater struct {
	pluginStore            pluginstore.Store
	pluginDashboardService plugindashboards.Service
	dashboardImportService dashboardimport.Service
	pluginSettingsService  pluginsettings.Service
	dashboardPluginService dashboards.PluginService
	dashboardService       dashboards.DashboardService
	logger                 log.Logger
}

func (du *DashboardUpdater) Run(ctx context.Context) error {
	du.updateAppDashboards(ctx)
	return nil
}

func (du *DashboardUpdater) updateAppDashboards(ctx context.Context) {
	du.logger.Debug("Looking for app dashboard updates")

	pluginSettings, err := du.pluginSettingsService.GetPluginSettings(context.Background(), &pluginsettings.GetArgs{OrgID: 0})
	if err != nil {
		du.logger.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range pluginSettings {
		// ignore disabled plugins
		if !pluginSetting.Enabled {
			continue
		}

		serviceCtx, _ := identity.WithServiceIdentity(ctx, pluginSetting.OrgID)
		if pluginDef, exists := du.pluginStore.Plugin(serviceCtx, pluginSetting.PluginID); exists {
			if pluginDef.Info.Version != pluginSetting.PluginVersion {
				du.syncPluginDashboards(serviceCtx, pluginDef, pluginSetting.OrgID)
			}
		}
	}
}

func (du *DashboardUpdater) syncPluginDashboards(ctx context.Context, plugin pluginstore.Plugin, orgID int64) {
	du.logger.Info("Syncing plugin dashboards to DB", "pluginId", plugin.ID)

	// Get plugin dashboards
	req := &plugindashboards.ListPluginDashboardsRequest{
		OrgID:    orgID,
		PluginID: plugin.ID,
	}
	resp, err := du.pluginDashboardService.ListPluginDashboards(ctx, req)
	if err != nil {
		du.logger.Error("Failed to load app dashboards", "error", err)
		return
	}

	// Update dashboards with updated revisions
	for _, dash := range resp.Items {
		// remove removed ones
		if dash.Removed {
			du.logger.Info("Deleting plugin dashboard", "pluginId", plugin.ID, "dashboard", dash.Slug)

			if err := du.dashboardService.DeleteDashboard(ctx, dash.DashboardId, dash.UID, orgID); err != nil {
				du.logger.Error("Failed to auto update app dashboard", "pluginId", plugin.ID, "error", err)
				return
			}

			continue
		}

		// update updated ones
		if dash.ImportedRevision != dash.Revision {
			if err := du.autoUpdateAppDashboard(ctx, dash, orgID); err != nil {
				du.logger.Error("Failed to auto update app dashboard", "pluginId", plugin.ID, "error", err)
				return
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := pluginsettings.GetByPluginIDArgs{PluginID: plugin.ID, OrgID: orgID}
	ps, err := du.pluginSettingsService.GetPluginSettingByPluginID(ctx, &query)
	if err != nil {
		du.logger.Error("Failed to read plugin setting by ID", "error", err)
		return
	}

	cmd := pluginsettings.UpdatePluginVersionArgs{
		OrgID:         ps.OrgID,
		PluginID:      ps.PluginID,
		PluginVersion: plugin.Info.Version,
	}

	if err := du.pluginSettingsService.UpdatePluginSettingPluginVersion(ctx, &cmd); err != nil {
		du.logger.Error("Failed to update plugin setting version", "error", err)
	}
}

func (du *DashboardUpdater) handlePluginStateChanged(ctx context.Context, event *pluginsettings.PluginStateChangedEvent) error {
	du.logger.Info("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)
	ctx, _ = identity.WithServiceIdentity(ctx, event.OrgId)

	if event.Enabled {
		p, exists := du.pluginStore.Plugin(ctx, event.PluginId)
		if !exists {
			return fmt.Errorf("plugin %s not found. Could not sync plugin dashboards", event.PluginId)
		}

		du.syncPluginDashboards(ctx, p, event.OrgId)
	} else {
		query := dashboards.GetDashboardsByPluginIDQuery{PluginID: event.PluginId, OrgID: event.OrgId}
		queryResult, err := du.dashboardPluginService.GetDashboardsByPluginID(ctx, &query)
		if err != nil {
			return err
		}

		for _, dash := range queryResult {
			du.logger.Info("Deleting plugin dashboard", "pluginId", event.PluginId, "dashboard", dash.Slug)
			if err := du.dashboardService.DeleteDashboard(ctx, dash.ID, dash.UID, dash.OrgID); err != nil {
				return err
			}
		}
	}

	return nil
}

func (du *DashboardUpdater) autoUpdateAppDashboard(ctx context.Context, pluginDashInfo *plugindashboards.PluginDashboard, orgID int64) error {
	req := &plugindashboards.LoadPluginDashboardRequest{
		PluginID:  pluginDashInfo.PluginId,
		Reference: pluginDashInfo.Reference,
	}
	resp, err := du.pluginDashboardService.LoadPluginDashboard(ctx, req)
	if err != nil {
		return err
	}
	du.logger.Info("Auto updating App dashboard", "dashboard", resp.Dashboard.Title, "newRev",
		pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
	_, err = du.dashboardImportService.ImportDashboard(ctx, &dashboardimport.ImportDashboardRequest{
		PluginId: pluginDashInfo.PluginId,
		User: accesscontrol.BackgroundUser("dashboard_updater", orgID, org.RoleAdmin, []accesscontrol.Permission{
			{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
			{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeFoldersAll},
		}),
		Path:      pluginDashInfo.Reference,
		Dashboard: resp.Dashboard.Data,
		Overwrite: true,
		Inputs:    nil,
	})
	return err
}
