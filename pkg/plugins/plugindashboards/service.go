package plugindashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tsdb"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:     "PluginDashboardService",
		Instance: &Service{},
	})
}

type Service struct {
	DataService   *tsdb.Service      `inject:""`
	PluginManager plugins.Manager    `inject:""`
	SQLStore      *sqlstore.SQLStore `inject:""`

	logger log.Logger
}

func (s *Service) Init() error {
	bus.AddEventListener(s.handlePluginStateChanged)
	s.logger = log.New("plugindashboards")
	return nil
}

func (s *Service) Run(ctx context.Context) error {
	s.updateAppDashboards()
	return nil
}

func (s *Service) updateAppDashboards() {
	s.logger.Debug("Looking for app dashboard updates")

	pluginSettings, err := s.SQLStore.GetPluginSettings(0)
	if err != nil {
		s.logger.Error("Failed to get all plugin settings", "error", err)
		return
	}

	for _, pluginSetting := range pluginSettings {
		// ignore disabled plugins
		if !pluginSetting.Enabled {
			continue
		}

		if pluginDef := s.PluginManager.GetPlugin(pluginSetting.PluginId); pluginDef != nil {
			if pluginDef.Info.Version != pluginSetting.PluginVersion {
				s.syncPluginDashboards(pluginDef, pluginSetting.OrgId)
			}
		}
	}
}

func (s *Service) syncPluginDashboards(pluginDef *plugins.PluginBase, orgID int64) {
	s.logger.Info("Syncing plugin dashboards to DB", "pluginId", pluginDef.Id)

	// Get plugin dashboards
	dashboards, err := s.PluginManager.GetPluginDashboards(orgID, pluginDef.Id)
	if err != nil {
		s.logger.Error("Failed to load app dashboards", "error", err)
		return
	}

	// Update dashboards with updated revisions
	for _, dash := range dashboards {
		// remove removed ones
		if dash.Removed {
			s.logger.Info("Deleting plugin dashboard", "pluginId", pluginDef.Id, "dashboard", dash.Slug)

			deleteCmd := models.DeleteDashboardCommand{OrgId: orgID, Id: dash.DashboardId}
			if err := bus.Dispatch(&deleteCmd); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", pluginDef.Id, "error", err)
				return
			}

			continue
		}

		// update updated ones
		if dash.ImportedRevision != dash.Revision {
			if err := s.autoUpdateAppDashboard(dash, orgID); err != nil {
				s.logger.Error("Failed to auto update app dashboard", "pluginId", pluginDef.Id, "error", err)
				return
			}
		}
	}

	// update version in plugin_setting table to mark that we have processed the update
	query := models.GetPluginSettingByIdQuery{PluginId: pluginDef.Id, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		s.logger.Error("Failed to read plugin setting by ID", "error", err)
		return
	}

	appSetting := query.Result
	cmd := models.UpdatePluginSettingVersionCmd{
		OrgId:         appSetting.OrgId,
		PluginId:      appSetting.PluginId,
		PluginVersion: pluginDef.Info.Version,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		s.logger.Error("Failed to update plugin setting version", "error", err)
	}
}

func (s *Service) handlePluginStateChanged(event *models.PluginStateChangedEvent) error {
	s.logger.Info("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	if event.Enabled {
		s.syncPluginDashboards(s.PluginManager.GetPlugin(event.PluginId), event.OrgId)
	} else {
		query := models.GetDashboardsByPluginIdQuery{PluginId: event.PluginId, OrgId: event.OrgId}
		if err := bus.Dispatch(&query); err != nil {
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

func (s *Service) autoUpdateAppDashboard(pluginDashInfo *plugins.PluginDashboardInfoDTO, orgID int64) error {
	dash, err := s.PluginManager.LoadPluginDashboard(pluginDashInfo.PluginId, pluginDashInfo.Path)
	if err != nil {
		return err
	}
	s.logger.Info("Auto updating App dashboard", "dashboard", dash.Title, "newRev",
		pluginDashInfo.Revision, "oldRev", pluginDashInfo.ImportedRevision)
	user := &models.SignedInUser{UserId: 0, OrgRole: models.ROLE_ADMIN}
	_, _, err = s.PluginManager.ImportDashboard(pluginDashInfo.PluginId, pluginDashInfo.Path, orgID, 0, dash.Data, true,
		nil, user, s.DataService)
	return err
}
