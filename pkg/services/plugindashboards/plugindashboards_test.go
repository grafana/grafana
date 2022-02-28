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
	t.Run("updateAppDashboards", func(t *testing.T) {
		scenario(t, "Without any stored plugin settings shouldn't delete/import any dashboards",
			scenarioInput{}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.Len(t, ctx.getPluginSettingsArgs, 1)
				require.Equal(t, int64(0), ctx.getPluginSettingsArgs[0])
				require.Empty(t, ctx.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "Without any stored enabled plugin shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*models.PluginSettingInfoDTO{
					{
						PluginId: "test",
						Enabled:  false,
					},
				},
				pluginDashboards: []*plugins.PluginDashboardInfoDTO{
					{
						PluginId: "test",
						Path:     "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.NotEmpty(t, ctx.getPluginSettingsArgs)
				require.Empty(t, ctx.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin, but not installed shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*models.PluginSettingInfoDTO{
					{
						PluginId: "test",
						Enabled:  true,
					},
				},
				pluginDashboards: []*plugins.PluginDashboardInfoDTO{
					{
						PluginId: "test",
						Path:     "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.NotEmpty(t, ctx.getPluginSettingsArgs)
				require.Empty(t, ctx.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with same version shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*models.PluginSettingInfoDTO{
					{
						PluginId:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
					},
				},
				installedPlugins: []plugins.PluginDTO{
					{
						JSONData: plugins.JSONData{
							Info: plugins.Info{
								Version: "1.0.0",
							},
						},
					},
				},
				pluginDashboards: []*plugins.PluginDashboardInfoDTO{
					{
						PluginId: "test",
						Path:     "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.NotEmpty(t, ctx.getPluginSettingsArgs)
				require.Empty(t, ctx.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with different versions, but no dashboard updates shouldn't delete/import dashboards",
			scenarioInput{
				storedPluginSettings: []*models.PluginSettingInfoDTO{
					{
						PluginId:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
					},
				},
				installedPlugins: []plugins.PluginDTO{
					{
						JSONData: plugins.JSONData{
							Info: plugins.Info{
								Version: "1.0.1",
							},
						},
					},
				},
				pluginDashboards: []*plugins.PluginDashboardInfoDTO{
					{
						PluginId:         "test",
						Path:             "dashboard.json",
						Removed:          false,
						Revision:         1,
						ImportedRevision: 1,
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.NotEmpty(t, ctx.getPluginSettingsArgs)
				require.Empty(t, ctx.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with different versions and with dashboard updates should delete/import dashboards",
			scenarioInput{
				storedPluginSettings: []*models.PluginSettingInfoDTO{
					{
						PluginId:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
						OrgId:         2,
					},
				},
				installedPlugins: []plugins.PluginDTO{
					{
						JSONData: plugins.JSONData{
							ID: "test",
							Info: plugins.Info{
								Version: "1.0.1",
							},
						},
					},
				},
				pluginDashboards: []*plugins.PluginDashboardInfoDTO{
					{
						DashboardId: 3,
						PluginId:    "test",
						Path:        "removed.json",
						Removed:     true,
					},
					{
						DashboardId: 4,
						PluginId:    "test",
						Path:        "not-updated.json",
					},
					{
						DashboardId:      5,
						PluginId:         "test",
						Path:             "updated.json",
						Revision:         1,
						ImportedRevision: 2,
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.s.updateAppDashboards()

				require.NotEmpty(t, ctx.getPluginSettingsArgs)
				require.Len(t, ctx.deleteDashboardArgs, 1)
				require.Equal(t, int64(2), ctx.deleteDashboardArgs[0].OrgId)
				require.Equal(t, int64(3), ctx.deleteDashboardArgs[0].Id)

				require.Len(t, ctx.importDashboardArgs, 1)
				require.Equal(t, "test", ctx.importDashboardArgs[0].PluginId)
				require.Equal(t, "updated.json", ctx.importDashboardArgs[0].Path)
				require.Equal(t, int64(2), ctx.importDashboardArgs[0].User.OrgId)
				require.Equal(t, models.ROLE_ADMIN, ctx.importDashboardArgs[0].User.OrgRole)
				require.Equal(t, int64(0), ctx.importDashboardArgs[0].FolderId)
				require.True(t, ctx.importDashboardArgs[0].Overwrite)
			})
	})

	t.Run("handlePluginStateChanged", func(t *testing.T) {
		scenario(t, "When app plugin is disabled that doesn't have any imported dashboards shouldn't delete any",
			scenarioInput{}, func(ctx *scenarioContext) {
				err := ctx.bus.Publish(context.Background(), &models.PluginStateChangedEvent{
					PluginId: "test",
					OrgId:    2,
					Enabled:  false,
				})
				require.NoError(t, err)

				require.Len(t, ctx.getDashboardsByPluginIdQueryArgs, 1)
				require.Equal(t, int64(2), ctx.getDashboardsByPluginIdQueryArgs[0].OrgId)
				require.Equal(t, "test", ctx.getDashboardsByPluginIdQueryArgs[0].PluginId)
				require.Empty(t, ctx.deleteDashboardArgs)
			})
	})

	scenario(t, "When app plugin is disabled that have imported dashboards should delete them",
		scenarioInput{
			storedPluginSettings: []*models.PluginSettingInfoDTO{
				{
					PluginId: "test",
					Enabled:  true,
					OrgId:    2,
				},
			},
			installedPlugins: []plugins.PluginDTO{
				{
					JSONData: plugins.JSONData{
						ID: "test",
					},
				},
			},
			pluginDashboards: []*plugins.PluginDashboardInfoDTO{
				{
					DashboardId: 3,
					PluginId:    "test",
					Path:        "dashboard1.json",
				},
				{
					DashboardId: 4,
					PluginId:    "test",
					Path:        "dashboard2.json",
				},
				{
					DashboardId: 5,
					PluginId:    "test",
					Path:        "dashboard3.json",
				},
			},
		}, func(ctx *scenarioContext) {
			err := ctx.bus.Publish(context.Background(), &models.PluginStateChangedEvent{
				PluginId: "test",
				OrgId:    2,
				Enabled:  false,
			})
			require.NoError(t, err)

			require.Len(t, ctx.getDashboardsByPluginIdQueryArgs, 1)
			require.Equal(t, int64(2), ctx.getDashboardsByPluginIdQueryArgs[0].OrgId)
			require.Equal(t, "test", ctx.getDashboardsByPluginIdQueryArgs[0].PluginId)
			require.Len(t, ctx.deleteDashboardArgs, 3)
		})

	scenario(t, "When app plugin is enabled, stored disabled plugin and with dashboard updates should import dashboards",
		scenarioInput{
			storedPluginSettings: []*models.PluginSettingInfoDTO{
				{
					PluginId:      "test",
					Enabled:       false,
					OrgId:         2,
					PluginVersion: "1.0.0",
				},
			},
			installedPlugins: []plugins.PluginDTO{
				{
					JSONData: plugins.JSONData{
						ID: "test",
						Info: plugins.Info{
							Version: "1.0.0",
						},
					},
				},
			},
			pluginDashboards: []*plugins.PluginDashboardInfoDTO{
				{
					DashboardId:      3,
					PluginId:         "test",
					Path:             "dashboard1.json",
					Revision:         1,
					ImportedRevision: 0,
				},
				{
					DashboardId:      4,
					PluginId:         "test",
					Path:             "dashboard2.json",
					Revision:         1,
					ImportedRevision: 0,
				},
				{
					DashboardId:      5,
					PluginId:         "test",
					Path:             "dashboard3.json",
					Revision:         1,
					ImportedRevision: 0,
				},
			},
		}, func(ctx *scenarioContext) {
			err := ctx.bus.Publish(context.Background(), &models.PluginStateChangedEvent{
				PluginId: "test",
				OrgId:    2,
				Enabled:  true,
			})
			require.NoError(t, err)

			require.Empty(t, ctx.deleteDashboardArgs)

			require.Len(t, ctx.importDashboardArgs, 3)
			require.Equal(t, "test", ctx.importDashboardArgs[0].PluginId)
			require.Equal(t, "dashboard1.json", ctx.importDashboardArgs[0].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[0].User.OrgId)
			require.Equal(t, models.ROLE_ADMIN, ctx.importDashboardArgs[0].User.OrgRole)
			require.Equal(t, int64(0), ctx.importDashboardArgs[0].FolderId)
			require.True(t, ctx.importDashboardArgs[0].Overwrite)

			require.Equal(t, "test", ctx.importDashboardArgs[1].PluginId)
			require.Equal(t, "dashboard2.json", ctx.importDashboardArgs[1].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[1].User.OrgId)
			require.Equal(t, models.ROLE_ADMIN, ctx.importDashboardArgs[1].User.OrgRole)
			require.Equal(t, int64(0), ctx.importDashboardArgs[1].FolderId)
			require.True(t, ctx.importDashboardArgs[1].Overwrite)

			require.Equal(t, "test", ctx.importDashboardArgs[2].PluginId)
			require.Equal(t, "dashboard3.json", ctx.importDashboardArgs[2].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[2].User.OrgId)
			require.Equal(t, models.ROLE_ADMIN, ctx.importDashboardArgs[2].User.OrgRole)
			require.Equal(t, int64(0), ctx.importDashboardArgs[2].FolderId)
			require.True(t, ctx.importDashboardArgs[2].Overwrite)
		})
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

type scenarioInput struct {
	storedPluginSettings []*models.PluginSettingInfoDTO
	installedPlugins     []plugins.PluginDTO
	pluginDashboards     []*plugins.PluginDashboardInfoDTO
}

type scenarioContext struct {
	t                                *testing.T
	bus                              bus.Bus
	pluginSettingsStore              pluginSettingsStore
	getPluginSettingsArgs            []int64
	pluginStore                      plugins.Store
	pluginDashboardManager           plugins.PluginDashboardManager
	importDashboardService           dashboardimport.Service
	importDashboardArgs              []*dashboardimport.ImportDashboardRequest
	deleteDashboardArgs              []*models.DeleteDashboardCommand
	getPluginSettingsByIdArgs        []*models.GetPluginSettingByIdQuery
	updatePluginSettingVersionArgs   []*models.UpdatePluginSettingVersionCmd
	getDashboardsByPluginIdQueryArgs []*models.GetDashboardsByPluginIdQuery
	s                                *Service
}

func scenario(t *testing.T, desc string, input scenarioInput, f func(ctx *scenarioContext)) {
	t.Helper()

	sCtx := &scenarioContext{
		t:                                t,
		bus:                              bus.New(),
		getPluginSettingsArgs:            []int64{},
		importDashboardArgs:              []*dashboardimport.ImportDashboardRequest{},
		deleteDashboardArgs:              []*models.DeleteDashboardCommand{},
		getPluginSettingsByIdArgs:        []*models.GetPluginSettingByIdQuery{},
		updatePluginSettingVersionArgs:   []*models.UpdatePluginSettingVersionCmd{},
		getDashboardsByPluginIdQueryArgs: []*models.GetDashboardsByPluginIdQuery{},
	}

	getPluginSettings := func(_ context.Context, orgID int64) ([]*models.PluginSettingInfoDTO, error) {
		sCtx.getPluginSettingsArgs = append(sCtx.getPluginSettingsArgs, orgID)
		return input.storedPluginSettings, nil
	}

	sCtx.pluginSettingsStore = &pluginSettingsStoreMock{
		getPluginSettingsFunc: getPluginSettings,
	}

	getPlugin := func(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
		for _, p := range input.installedPlugins {
			if p.ID == pluginID {
				return p, true
			}
		}

		return plugins.PluginDTO{}, false
	}

	sCtx.pluginStore = &pluginStoreMock{
		pluginFunc: getPlugin,
	}

	getPluginDashboards := func(ctx context.Context, orgID int64, pluginID string) ([]*plugins.PluginDashboardInfoDTO, error) {
		dashboards := []*plugins.PluginDashboardInfoDTO{}

		for _, d := range input.pluginDashboards {
			if d.PluginId == pluginID {
				dashboards = append(dashboards, d)
			}
		}

		return dashboards, nil
	}

	loadPluginDashboard := func(ctx context.Context, pluginID, path string) (*models.Dashboard, error) {
		for _, d := range input.pluginDashboards {
			if d.PluginId == pluginID && path == d.Path {
				return &models.Dashboard{}, nil
			}
		}

		return nil, fmt.Errorf("no match for loading plugin dashboard")
	}

	sCtx.pluginDashboardManager = &pluginDashboardManagerMock{
		getPluginDashboardsFunc: getPluginDashboards,
		loadPluginDashboardFunc: loadPluginDashboard,
	}

	importDashboard := func(ctx context.Context, req *dashboardimport.ImportDashboardRequest) (*dashboardimport.ImportDashboardResponse, error) {
		sCtx.importDashboardArgs = append(sCtx.importDashboardArgs, req)

		return &dashboardimport.ImportDashboardResponse{
			PluginId: req.PluginId,
		}, nil
	}

	sCtx.importDashboardService = &importDashboardServiceMock{
		importDashboardFunc: importDashboard,
	}

	sCtx.bus.AddHandler(func(ctx context.Context, cmd *models.DeleteDashboardCommand) error {
		sCtx.deleteDashboardArgs = append(sCtx.deleteDashboardArgs, cmd)

		return nil
	})

	mock := &mockPluginsSettingsService{}
	for _, p := range input.storedPluginSettings {
		mock.pluginSetting = &models.PluginSetting{
			PluginId: p.PluginId,
			OrgId:    p.OrgId,
		}
	}

	sCtx.bus.AddHandler(func(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
		sCtx.getDashboardsByPluginIdQueryArgs = append(sCtx.getDashboardsByPluginIdQueryArgs, query)
		dashboards := []*models.Dashboard{}

		var plugin *models.PluginSettingInfoDTO

		for _, p := range input.storedPluginSettings {
			if p.PluginId == query.PluginId {
				plugin = p
			}
		}

		if plugin == nil {
			return nil
		}

		for _, d := range input.pluginDashboards {
			if d.PluginId == plugin.PluginId {
				dashboards = append(dashboards, &models.Dashboard{
					Id:    d.DashboardId,
					OrgId: plugin.OrgId,
				})
			}
		}

		query.Result = dashboards

		return nil
	})

	sCtx.s = new(sCtx.pluginSettingsStore, sCtx.bus, sCtx.pluginStore, sCtx.pluginDashboardManager, sCtx.importDashboardService, mock)

	t.Cleanup(bus.ClearBusHandlers)

	t.Run(desc, func(t *testing.T) {
		f(sCtx)
	})
}

type mockPluginsSettingsService struct {
	pluginSetting *models.PluginSetting
	err           error
}

func (s *mockPluginsSettingsService) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	query.Result = s.pluginSetting
	return s.err
}

func (s *mockPluginsSettingsService) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return s.err
}

func (s *mockPluginsSettingsService) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return s.err
}
