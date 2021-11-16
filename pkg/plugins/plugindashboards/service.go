package plugindashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(pluginStore plugins.Store, pluginDashboardManager plugins.PluginDashboardManager,
	sqlStore *sqlstore.SQLStore) *Service {
	s := &Service{
		sqlStore:               sqlStore,
		pluginStore:            pluginStore,
		pluginDashboardManager: pluginDashboardManager,
		logger:                 log.New("plugindashboards"),
	}
	bus.AddEventListener(s.handlePluginStateChanged)
	s.updateAppDashboards()
	return s
}

type Service struct {
	sqlStore               *sqlstore.SQLStore
	pluginStore            plugins.Store
	pluginDashboardManager plugins.PluginDashboardManager

	logger log.Logger
}

func (s *Service) updateAppDashboards() {
	s.logger.Debug("Looking for app dashboard updates")

	pluginSettings, err := s.sqlStore.GetPluginSettings(context.Background(), 0)
	if err != nil {
		s.logger.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range pluginSettings {
		// ignore disabled plugins
		if !pluginSetting.Enabled {
			continue
		}

		if pluginDef := s.pluginStore.Plugin(pluginSetting.PluginId); pluginDef != nil {
			if pluginDef.Info.Version != pluginSetting.PluginVersion {
				s.syncPluginDashboards(context.Background(), pluginDef, pluginSetting.OrgId)
			}
		}
	}
}

func (s *Service) syncPluginDashboards(ctx context.Context, pluginDef *plugins.Plugin, orgID int64) {
	s.logger.Info("Syncing plugin dashboards to DB", "pluginId", pluginDef.ID)

	// Get plugin dashboards
	dashboards, err := s.pluginDashboardManager.GetPluginDashboards(orgID, pluginDef.ID)
	if err != nil {
		s.logger.Error("Failed to load app dashboards", "error", err)
		return
	}

	// Update dashboards with updated revisions
	for _, dash := range dashboards {
		// remove removed ones
		if dash.Removed {
			s.logger.Info("Deleting plugin dashboard", "pluginId", pluginDef.ID, "dashboard", dash.Slug)

			deleteCmd := models.DeleteDashboardCommand{OrgId: orgID, Id: dash.DashboardId}
			if err := bus.Dispatch(&deleteCmd); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", pluginDef.ID, "error", err)
				return
			}

			continue
		}

		// update updated ones
		if dash.ImportedRevision != dash.Revision {
			if err := s.autoUpdateAppDashboard(ctx, dash, orgID); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", pluginDef.ID, "error", err)
				return
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := models.GetPluginSettingByIdQuery{PluginId: pluginDef.ID, OrgId: orgID}
	if err := bus.DispatchCtx(ctx, &query); err != nil {
		s.logger.Error("Failed to read plugin setting by ID", "error", err)
		return
	}

	appSetting := query.Result
	cmd := models.UpdatePluginSettingVersionCmd{
		OrgId:         appSetting.OrgId,
		PluginId:      appSetting.PluginId,
		PluginVersion: pluginDef.Info.Version,
	}

	if err := bus.DispatchCtx(ctx, &cmd); err != nil {
		s.logger.Error("Failed to update plugin setting version", "error", err)
	}
}

func (s *Service) handlePluginStateChanged(event *models.PluginStateChangedEvent) error {
	s.logger.Info("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	if event.Enabled {
		s.syncPluginDashboards(context.TODO(), s.pluginStore.Plugin(event.PluginId), event.OrgId)
	} else {
		query := models.GetDashboardsByPluginIdQuery{PluginId: event.PluginId, OrgId: event.OrgId}
		if err := bus.DispatchCtx(context.TODO(), &query); err != nil {
			return err
		}

		for _, dash := range query.Result {
			s.logger.Info("Deleting plugin dashboard", "pluginId", event.PluginId, "dashboard", dash.Slug)
			deleteCmd := models.DeleteDashboardCommand{OrgId: dash.OrgId, Id: dash.Id}
			if err := bus.Dispatch(&deleteCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Service) autoUpdateAppDashboard(ctx context.Context, pluginDashInfo *plugins.PluginDashboardInfoDTO, orgID int64) error {
	dash, err := s.pluginDashboardManager.LoadPluginDashboard(pluginDashInfo.PluginId, pluginDashInfo.Path)
	if err != nil {
		return err
	}
	s.logger.Info("Auto updating App dashboard", "dashboard", dash.Title, "newRev",
		pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
	user := &models.SignedInUser{UserId: 0, OrgRole: models.ROLE_ADMIN}
	_, _, err = s.pluginDashboardManager.ImportDashboard(ctx, pluginDashInfo.PluginId, pluginDashInfo.Path, orgID, 0, dash.Data, true,
		nil, user)
	return err
}
