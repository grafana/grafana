package plugindashboards

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	t.Run("Creating a new service should not update app dashboards when there's no plugins ", func(t *testing.T) {
		s := setup(t, setupArgs{})
		require.NotNil(t, s)
	})

	t.Run("Creating a new service should update app dashboards when needed ", func(t *testing.T) {
		getPluginSettings := func(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error) {
			return []*models.PluginSettingInfoDTO{
				{
					PluginId: "disabled",
					Enabled:  false,
				},
				{
					PluginId:      "enabled",
					Enabled:       true,
					PluginVersion: "1.0.0",
					OrgId:         2,
				},
			}, nil
		}
		getPlugin := func(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
			if pluginID == "enabled" {
				return plugins.PluginDTO{
					JSONData: plugins.JSONData{
						ID: "enabled",
						Info: plugins.Info{
							Version: "1.0.1",
						},
					},
				}, true
			}

			return plugins.PluginDTO{}, false
		}
		getPluginDashboards := func(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error) {
			if orgID == 2 && pluginID == "enabled" {
				return []*plugins.PluginDashboardInfoDTO{
					{
						DashboardId: 3,
						PluginId:    "enabled",
						Removed:     true,
					},
					{
						DashboardId:      4,
						PluginId:         "enabled",
						Removed:          false,
						ImportedRevision: 1,
						Revision:         2,
						Path:             "dashboard.json",
					},
				}, nil
			}

			return nil, fmt.Errorf("Unexpected plugin argument")
		}
		loadPluginDashboard := func(ctx context.Context, pluginID, path string) (*models.Dashboard, error) {
			if pluginID == "enabled" && path == "dashboard.json" {
				return &models.Dashboard{
					Id: 4,
				}, nil
			}

			return nil, fmt.Errorf("Unexpected arguments provided")
		}
		var importDashboardArg *dashboardimport.ImportDashboardRequest
		importDashboard := func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
			importDashboardArg = req
			return &dashboardimport.ImportDashboardResponse{
				PluginId: req.PluginId,
			}, nil
		}

		var deleteDashboardArg *models.DeleteDashboardCommand
		handleDeleteDashboard := func(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
			deleteDashboardArg = cmd
			return nil
		}
		var getPluginSettingsByIdArg *models.GetPluginSettingByIdQuery
		handleGetPluginSettingsById := func(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
			query.Result = &models.PluginSetting{
				PluginId: "enabled",
				OrgId:    2,
			}

			getPluginSettingsByIdArg = query
			return nil
		}

		var updatePluginSettingVersionArg *models.UpdatePluginSettingVersionCmd
		handleUpdatePluginSettingVersion := func(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
			updatePluginSettingVersionArg = cmd
			return nil
		}

		s := setup(t, setupArgs{
			getPluginSettingsFunc:            getPluginSettings,
			pluginFunc:                       getPlugin,
			getPluginDashboardsFunc:          getPluginDashboards,
			loadPluginDashboardFunc:          loadPluginDashboard,
			importDashboardFunc:              importDashboard,
			handleDeleteDashboard:            handleDeleteDashboard,
			handleGetPluginSettingsById:      handleGetPluginSettingsById,
			handleUpdatePluginSettingVersion: handleUpdatePluginSettingVersion,
		})
		require.NotNil(t, s)
		require.NotNil(t, deleteDashboardArg)
		require.Equal(t, int64(2), deleteDashboardArg.OrgId)
		require.Equal(t, int64(3), deleteDashboardArg.Id)
		require.NotNil(t, importDashboardArg)
		require.Equal(t, "enabled", importDashboardArg.PluginId)
		require.Equal(t, "dashboard.json", importDashboardArg.Path)
		require.True(t, importDashboardArg.Overwrite)
		require.Equal(t, int64(2), importDashboardArg.User.OrgId)
		require.Equal(t, models.ROLE_ADMIN, importDashboardArg.User.OrgRole)

		require.NotNil(t, getPluginSettingsByIdArg)
		require.Equal(t, int64(2), getPluginSettingsByIdArg.OrgId)
		require.Equal(t, "enabled", getPluginSettingsByIdArg.PluginId)
		require.NotNil(t, updatePluginSettingVersionArg)
		require.Equal(t, int64(2), updatePluginSettingVersionArg.OrgId)
		require.Equal(t, "enabled", updatePluginSettingVersionArg.PluginId)
		require.Equal(t, "1.0.1", updatePluginSettingVersionArg.PluginVersion)
	})
}

type setupArgs struct {
	getPluginSettingsFunc            func(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
	pluginFunc                       func(ctx context.Context, pluginID string) (plugins.PluginDTO, bool)
	getPluginDashboardsFunc          func(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error)
	loadPluginDashboardFunc          func(ctx context.Context, pluginID, path string) (*models.Dashboard, error)
	importDashboardFunc              func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error)
	handleDeleteDashboard            func(ctx context.Context, cmd *models.DeleteDashboardCommand) error
	handleGetPluginSettingsById      func(ctx context.Context, query *models.GetPluginSettingByIdQuery) error
	handleUpdatePluginSettingVersion func(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error
}

func setup(t *testing.T, args setupArgs) *Service {
	t.Helper()

	pluginSettingsStore := &pluginSettingsStoreMock{
		getPluginSettingsFunc: args.getPluginSettingsFunc,
	}
	bus := bus.New()
	bus.AddHandler(args.handleDeleteDashboard)
	bus.AddHandler(args.handleGetPluginSettingsById)
	bus.AddHandler(args.handleUpdatePluginSettingVersion)
	pluginStore := &pluginStoreMock{
		pluginFunc: args.pluginFunc,
	}
	pluginDashboardManager := &pluginDashboardManagerMock{
		getPluginDashboardsFunc: args.getPluginDashboardsFunc,
		loadPluginDashboardFunc: args.loadPluginDashboardFunc,
	}
	importDashboardService := &importDashboardServiceMock{
		importDashboardFunc: args.importDashboardFunc,
	}
	return new(pluginSettingsStore, bus, pluginStore, pluginDashboardManager, importDashboardService)
}

type pluginSettingsStoreMock struct {
	getPluginSettingsFunc func(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error)
}

func (m *pluginSettingsStoreMock) GetPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error) {
	if m.getPluginSettingsFunc != nil {
		return m.getPluginSettingsFunc(ctx, orgID)
	}

	return nil, nil
}

type pluginStoreMock struct {
	plugins.Store
	pluginFunc func(ctx context.Context, pluginID string) (plugins.PluginDTO, bool)
}

func (m *pluginStoreMock) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	if m.pluginFunc != nil {
		return m.pluginFunc(ctx, pluginID)
	}

	return plugins.PluginDTO{}, false
}

type pluginDashboardManagerMock struct {
	plugins.PluginDashboardManager
	getPluginDashboardsFunc func(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error)
	loadPluginDashboardFunc func(ctx context.Context, pluginID, path string) (*models.Dashboard, error)
}

func (m *pluginDashboardManagerMock) GetPluginDashboards(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error) {
	if m.getPluginDashboardsFunc != nil {
		return m.getPluginDashboardsFunc(ctx, orgID, pluginID)
	}

	return []*plugins.PluginDashboardInfoDTO{}, nil
}

func (m *pluginDashboardManagerMock) LoadPluginDashboard(ctx context.Context, pluginID, path string) (*models.Dashboard, error) {
	if m.loadPluginDashboardFunc != nil {
		return m.loadPluginDashboardFunc(ctx, pluginID, path)
	}

	return nil, nil
}

type importDashboardServiceMock struct {
	dashboardimport.Service
	importDashboardFunc func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error)
}

func (m *importDashboardServiceMock) ImportDashboard(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
	if m.importDashboardFunc != nil {
		return m.importDashboardFunc(ctx, req)
	}

	return nil, nil
}
