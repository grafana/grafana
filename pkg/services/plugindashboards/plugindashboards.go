package plugindashboards

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type pluginSettingsStore interface {
	GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
}

func ProvideService(sqlStore *sqlstore.SQLStore, bus bus.Bus, pluginStore plugins.Store,
	pluginDashboardManager plugins.PluginDashboardManager, dashboardImportService dashboardimport.Service,
	pluginSettingsStore *pluginsettings.ServiceImpl) *Service {
	s := new(sqlStore, bus, pluginStore, pluginDashboardManager, dashboardImportService, pluginSettingsStore)
	s.updateAppDashboards()
	return s
}

func new(pluginSettingsStore pluginSettingsStore, bus bus.Bus, pluginStore plugins.Store,
	pluginDashboardManager plugins.PluginDashboardManager, dashboardImportService dashboardimport.Service,
	pluginSettings pluginsettings.Service) *Service {
	s := &Service{
		pluginSettingsStore:    pluginSettingsStore,
		bus:                    bus,
		pluginStore:            pluginStore,
		pluginDashboardManager: pluginDashboardManager,
		dashboardImportService: dashboardImportService,
		logger:                 log.New("plugindashboards"),
		pluginSettings:         pluginSettings,
	}
	bus.AddEventListener(s.handlePluginStateChanged)

	return s
}

type Service struct {
	pluginSettingsStore    pluginSettingsStore
	bus                    bus.Bus
	pluginStore            plugins.Store
	pluginDashboardManager plugins.PluginDashboardManager
	dashboardImportService dashboardimport.Service
	logger                 log.Logger
	pluginSettings         pluginsettings.Service
}

func (s *Service) updateAppDashboards() {
	s.logger.Debug("Looking for app dashboard updates")

	pluginSettings, err := s.pluginSettingsStore.GetPluginSettings(context.Background(), 0)
	if err != nil {
		s.logger.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range pluginSettings {
		// ignore disabled plugins
		if !pluginSetting.Enabled {
			continue
		}

		if pluginDef, exists := s.pluginStore.Plugin(context.Background(), pluginSetting.PluginId); exists {
			if pluginDef.Info.Version != pluginSetting.PluginVersion {
				s.syncPluginDashboards(context.Background(), pluginDef, pluginSetting.OrgId)
			}
		}
	}
}

func (s *Service) syncPluginDashboards(ctx context.Context, plugin plugins.PluginDTO, orgID int64) {
	s.logger.Info("Syncing plugin dashboards to DB", "pluginId", plugin.ID)

	// Get plugin dashboards
	dashboards, err := s.pluginDashboardManager.GetPluginDashboards(ctx, orgID, plugin.ID)
	if err != nil {
		s.logger.Error("Failed to load app dashboards", "error", err)
		return
	}

	// Update dashboards with updated revisions
	for _, dash := range dashboards {
		// remove removed ones
		if dash.Removed {
			s.logger.Info("Deleting plugin dashboard", "pluginId", plugin.ID, "dashboard", dash.Slug)

			deleteCmd := models.DeleteDashboardCommand{OrgId: orgID, Id: dash.DashboardId}
			if err := s.bus.Dispatch(ctx, &deleteCmd); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", plugin.ID, "error", err)
				return
			}

			continue
		}

		// update updated ones
		if dash.ImportedRevision != dash.Revision {
			if err := s.autoUpdateAppDashboard(ctx, dash, orgID); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", plugin.ID, "error", err)
				return
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := models.GetPluginSettingByIdQuery{PluginId: plugin.ID, OrgId: orgID}
	if err := s.pluginSettings.GetPluginSettingById(ctx, &query); err != nil {
		s.logger.Error("Failed to read plugin setting by ID", "error", err)
		return
	}

	appSetting := query.Result
	cmd := models.UpdatePluginSettingVersionCmd{
		OrgId:         appSetting.OrgId,
		PluginId:      appSetting.PluginId,
		PluginVersion: plugin.Info.Version,
	}

	if err := s.pluginSettings.UpdatePluginSettingVersion(ctx, &cmd); err != nil {
		s.logger.Error("Failed to update plugin setting version", "error", err)
	}
}

func (s *Service) handlePluginStateChanged(ctx context.Context, event *models.PluginStateChangedEvent) error {
	s.logger.Info("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	if event.Enabled {
		p, exists := s.pluginStore.Plugin(ctx, event.PluginId)
		if !exists {
			return fmt.Errorf("plugin %s not found. Could not sync plugin dashboards", event.PluginId)
		}

		s.syncPluginDashboards(ctx, p, event.OrgId)
	} else {
		query := models.GetDashboardsByPluginIdQuery{PluginId: event.PluginId, OrgId: event.OrgId}
		if err := s.bus.Dispatch(ctx, &query); err != nil {
			return err
		}

		for _, dash := range query.Result {
			s.logger.Info("Deleting plugin dashboard", "pluginId", event.PluginId, "dashboard", dash.Slug)
			deleteCmd := models.DeleteDashboardCommand{OrgId: dash.OrgId, Id: dash.Id}
			if err := s.bus.Dispatch(ctx, &deleteCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Service) autoUpdateAppDashboard(ctx context.Context, pluginDashInfo *plugins.PluginDashboardInfoDTO, orgID int64) error {
	dash, err := s.pluginDashboardManager.LoadPluginDashboard(ctx, pluginDashInfo.PluginId, pluginDashInfo.Path)
	if err != nil {
		return err
	}
	s.logger.Info("Auto updating App dashboard", "dashboard", dash.Title, "newRev",
		pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
	_, err = s.dashboardImportService.ImportDashboard(ctx, &dashboardimport.ImportDashboardRequest{
		PluginId:  pluginDashInfo.PluginId,
		User:      &models.SignedInUser{UserId: 0, OrgRole: models.ROLE_ADMIN, OrgId: orgID},
		Path:      pluginDashInfo.Path,
		FolderId:  0,
		Dashboard: dash.Data,
		Overwrite: true,
		Inputs:    nil,
	})
	return err
}
