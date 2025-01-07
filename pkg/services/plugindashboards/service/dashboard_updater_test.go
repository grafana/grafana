package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestDashboardUpdater(t *testing.T) {
	t.Run("updateAppDashboards", func(t *testing.T) {
		scenario(t, "Without any stored plugin settings shouldn't delete/import any dashboards",
			scenarioInput{}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.Len(t, ctx.pluginSettingsService.getPluginSettingsArgs, 1)
				require.Equal(t, int64(0), ctx.pluginSettingsService.getPluginSettingsArgs[0])
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "Without any stored enabled plugin shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*pluginsettings.DTO{
					{
						PluginID: "test",
						Enabled:  false,
					},
				},
				pluginDashboards: []*plugindashboards.PluginDashboard{
					{
						PluginId:  "test",
						Reference: "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.NotEmpty(t, ctx.pluginSettingsService.getPluginSettingsArgs)
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin, but not installed shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*pluginsettings.DTO{
					{
						PluginID: "test",
						Enabled:  true,
					},
				},
				pluginDashboards: []*plugindashboards.PluginDashboard{
					{
						PluginId:  "test",
						Reference: "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.NotEmpty(t, ctx.pluginSettingsService.getPluginSettingsArgs)
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with same version shouldn't delete/import any dashboards",
			scenarioInput{
				storedPluginSettings: []*pluginsettings.DTO{
					{
						PluginID:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
					},
				},
				installedPlugins: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							Info: plugins.Info{
								Version: "1.0.0",
							},
						},
					},
				},
				pluginDashboards: []*plugindashboards.PluginDashboard{
					{
						PluginId:  "test",
						Reference: "dashboard.json",
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.NotEmpty(t, ctx.pluginSettingsService.getPluginSettingsArgs)
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with different versions, but no dashboard updates shouldn't delete/import dashboards",
			scenarioInput{
				storedPluginSettings: []*pluginsettings.DTO{
					{
						PluginID:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
					},
				},
				installedPlugins: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							Info: plugins.Info{
								Version: "1.0.1",
							},
						},
					},
				},
				pluginDashboards: []*plugindashboards.PluginDashboard{
					{
						PluginId:         "test",
						Reference:        "dashboard.json",
						Removed:          false,
						Revision:         1,
						ImportedRevision: 1,
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.NotEmpty(t, ctx.pluginSettingsService.getPluginSettingsArgs)
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
				require.Empty(t, ctx.importDashboardArgs)
			})

		scenario(t, "With stored enabled plugin and installed with different versions and with dashboard updates should delete/import dashboards",
			scenarioInput{
				storedPluginSettings: []*pluginsettings.DTO{
					{
						PluginID:      "test",
						Enabled:       true,
						PluginVersion: "1.0.0",
						OrgID:         2,
					},
				},
				installedPlugins: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID: "test",
							Info: plugins.Info{
								Version: "1.0.1",
							},
						},
					},
				},
				pluginDashboards: []*plugindashboards.PluginDashboard{
					{
						DashboardId: 3,
						PluginId:    "test",
						Reference:   "removed.json",
						Removed:     true,
					},
					{
						DashboardId: 4,
						PluginId:    "test",
						Reference:   "not-updated.json",
					},
					{
						DashboardId:      5,
						PluginId:         "test",
						Reference:        "updated.json",
						Revision:         1,
						ImportedRevision: 2,
					},
				},
			}, func(ctx *scenarioContext) {
				ctx.dashboardUpdater.updateAppDashboards()

				require.NotEmpty(t, ctx.pluginSettingsService.getPluginSettingsArgs)
				require.Len(t, ctx.dashboardService.deleteDashboardArgs, 1)
				require.Equal(t, int64(2), ctx.dashboardService.deleteDashboardArgs[0].orgId)
				require.Equal(t, int64(3), ctx.dashboardService.deleteDashboardArgs[0].dashboardId)

				require.Len(t, ctx.importDashboardArgs, 1)
				require.Equal(t, "test", ctx.importDashboardArgs[0].PluginId)
				require.Equal(t, "updated.json", ctx.importDashboardArgs[0].Path)
				require.Equal(t, int64(2), ctx.importDashboardArgs[0].User.GetOrgID())
				require.Equal(t, org.RoleAdmin, ctx.importDashboardArgs[0].User.GetOrgRole())
				require.Equal(t, string(""), ctx.importDashboardArgs[0].FolderUid)
				require.True(t, ctx.importDashboardArgs[0].Overwrite)
			})
	})

	t.Run("handlePluginStateChanged", func(t *testing.T) {
		scenario(t, "When app plugin is disabled that doesn't have any imported dashboards shouldn't delete any",
			scenarioInput{}, func(ctx *scenarioContext) {
				err := ctx.bus.Publish(context.Background(), &pluginsettings.PluginStateChangedEvent{
					PluginId: "test",
					OrgId:    2,
					Enabled:  false,
				})
				require.NoError(t, err)

				require.Len(t, ctx.dashboardPluginService.args, 1)
				require.Equal(t, int64(2), ctx.dashboardPluginService.args[0].OrgID)
				require.Equal(t, "test", ctx.dashboardPluginService.args[0].PluginID)
				require.Empty(t, ctx.dashboardService.deleteDashboardArgs)
			})
	})

	scenario(t, "When app plugin is disabled that have imported dashboards should delete them",
		scenarioInput{
			storedPluginSettings: []*pluginsettings.DTO{
				{
					PluginID: "test",
					Enabled:  true,
					OrgID:    2,
				},
			},
			installedPlugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID: "test",
					},
				},
			},
			pluginDashboards: []*plugindashboards.PluginDashboard{
				{
					DashboardId: 3,
					PluginId:    "test",
					Reference:   "dashboard1.json",
				},
				{
					DashboardId: 4,
					PluginId:    "test",
					Reference:   "dashboard2.json",
				},
				{
					DashboardId: 5,
					PluginId:    "test",
					Reference:   "dashboard3.json",
				},
			},
		}, func(ctx *scenarioContext) {
			err := ctx.bus.Publish(context.Background(), &pluginsettings.PluginStateChangedEvent{
				PluginId: "test",
				OrgId:    2,
				Enabled:  false,
			})
			require.NoError(t, err)

			require.Len(t, ctx.dashboardPluginService.args, 1)
			require.Equal(t, int64(2), ctx.dashboardPluginService.args[0].OrgID)
			require.Equal(t, "test", ctx.dashboardPluginService.args[0].PluginID)
			require.Len(t, ctx.dashboardService.deleteDashboardArgs, 3)
		})

	scenario(t, "When app plugin is enabled, stored disabled plugin and with dashboard updates should import dashboards",
		scenarioInput{
			storedPluginSettings: []*pluginsettings.DTO{
				{
					PluginID:      "test",
					Enabled:       false,
					OrgID:         2,
					PluginVersion: "1.0.0",
				},
			},
			installedPlugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID: "test",
						Info: plugins.Info{
							Version: "1.0.0",
						},
					},
				},
			},
			pluginDashboards: []*plugindashboards.PluginDashboard{
				{
					DashboardId:      3,
					PluginId:         "test",
					Reference:        "dashboard1.json",
					Revision:         1,
					ImportedRevision: 0,
				},
				{
					DashboardId:      4,
					PluginId:         "test",
					Reference:        "dashboard2.json",
					Revision:         1,
					ImportedRevision: 0,
				},
				{
					DashboardId:      5,
					PluginId:         "test",
					Reference:        "dashboard3.json",
					Revision:         1,
					ImportedRevision: 0,
				},
			},
		}, func(ctx *scenarioContext) {
			err := ctx.bus.Publish(context.Background(), &pluginsettings.PluginStateChangedEvent{
				PluginId: "test",
				OrgId:    2,
				Enabled:  true,
			})
			require.NoError(t, err)

			require.Empty(t, ctx.dashboardService.deleteDashboardArgs)

			require.Len(t, ctx.importDashboardArgs, 3)
			require.Equal(t, "test", ctx.importDashboardArgs[0].PluginId)
			require.Equal(t, "dashboard1.json", ctx.importDashboardArgs[0].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[0].User.GetOrgID())
			require.Equal(t, org.RoleAdmin, ctx.importDashboardArgs[0].User.GetOrgRole())
			require.Equal(t, string(""), ctx.importDashboardArgs[0].FolderUid)
			require.True(t, ctx.importDashboardArgs[0].Overwrite)

			require.Equal(t, "test", ctx.importDashboardArgs[1].PluginId)
			require.Equal(t, "dashboard2.json", ctx.importDashboardArgs[1].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[1].User.GetOrgID())
			require.Equal(t, org.RoleAdmin, ctx.importDashboardArgs[1].User.GetOrgRole())
			require.Equal(t, string(""), ctx.importDashboardArgs[0].FolderUid)
			require.True(t, ctx.importDashboardArgs[1].Overwrite)

			require.Equal(t, "test", ctx.importDashboardArgs[2].PluginId)
			require.Equal(t, "dashboard3.json", ctx.importDashboardArgs[2].Path)
			require.Equal(t, int64(2), ctx.importDashboardArgs[2].User.GetOrgID())
			require.Equal(t, org.RoleAdmin, ctx.importDashboardArgs[2].User.GetOrgRole())
			require.Equal(t, string(""), ctx.importDashboardArgs[0].FolderUid)
			require.True(t, ctx.importDashboardArgs[2].Overwrite)
		})
}

type pluginStoreMock struct {
	pluginstore.Store
	pluginFunc func(ctx context.Context, pluginID string) (pluginstore.Plugin, bool)
}

func (m *pluginStoreMock) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	if m.pluginFunc != nil {
		return m.pluginFunc(ctx, pluginID)
	}

	return pluginstore.Plugin{}, false
}

type pluginDashboardServiceMock struct {
	listPluginDashboardsFunc func(ctx context.Context, req *plugindashboards.ListPluginDashboardsRequest) (*plugindashboards.ListPluginDashboardsResponse, error)
	loadPluginDashboardfunc  func(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error)
}

func (m *pluginDashboardServiceMock) ListPluginDashboards(ctx context.Context, req *plugindashboards.ListPluginDashboardsRequest) (*plugindashboards.ListPluginDashboardsResponse, error) {
	if m.listPluginDashboardsFunc != nil {
		return m.listPluginDashboardsFunc(ctx, req)
	}

	return &plugindashboards.ListPluginDashboardsResponse{
		Items: []*plugindashboards.PluginDashboard{},
	}, nil
}

func (m *pluginDashboardServiceMock) LoadPluginDashboard(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error) {
	if m.loadPluginDashboardfunc != nil {
		return m.loadPluginDashboardfunc(ctx, req)
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

type pluginsSettingsServiceMock struct {
	service.Service

	storedPluginSettings  []*pluginsettings.DTO
	getPluginSettingsArgs []int64
	err                   error
}

func (s *pluginsSettingsServiceMock) GetPluginSettings(_ context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.InfoDTO, error) {
	s.getPluginSettingsArgs = append(s.getPluginSettingsArgs, args.OrgID)

	res := make([]*pluginsettings.InfoDTO, len(s.storedPluginSettings))
	for i, ps := range s.storedPluginSettings {
		res[i] = &pluginsettings.InfoDTO{
			PluginID:      ps.PluginID,
			OrgID:         ps.OrgID,
			Enabled:       ps.Enabled,
			Pinned:        ps.Pinned,
			PluginVersion: ps.PluginVersion,
		}
	}

	return res, s.err
}

func (s *pluginsSettingsServiceMock) GetPluginSettingByPluginID(_ context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	for _, setting := range s.storedPluginSettings {
		if setting.PluginID == args.PluginID {
			return &pluginsettings.DTO{
				PluginID: args.PluginID,
				OrgID:    args.OrgID,
			}, nil
		}
	}

	return nil, s.err
}

func (s *pluginsSettingsServiceMock) UpdatePluginSettingPluginVersion(_ context.Context, _ *pluginsettings.UpdatePluginVersionArgs) error {
	return s.err
}

func (s *pluginsSettingsServiceMock) UpdatePluginSetting(_ context.Context, _ *pluginsettings.UpdateArgs) error {
	return s.err
}

func (s *pluginsSettingsServiceMock) DecryptedValues(_ *pluginsettings.DTO) map[string]string {
	return nil
}

type dashboardServiceMock struct {
	dashboards.DashboardService
	deleteDashboardArgs []struct {
		orgId        int64
		dashboardId  int64
		dashboardUID string
	}
}

func (s *dashboardServiceMock) DeleteDashboard(_ context.Context, dashboardId int64, dashboardUID string, orgId int64) error {
	s.deleteDashboardArgs = append(s.deleteDashboardArgs, struct {
		orgId        int64
		dashboardId  int64
		dashboardUID string
	}{
		orgId:        orgId,
		dashboardId:  dashboardId,
		dashboardUID: dashboardUID,
	})
	return nil
}

func (s *dashboardServiceMock) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*dashboards.Dashboard, error) {
	return nil, nil
}

type scenarioInput struct {
	storedPluginSettings []*pluginsettings.DTO
	installedPlugins     []pluginstore.Plugin
	pluginDashboards     []*plugindashboards.PluginDashboard
}

type scenarioContext struct {
	t                              *testing.T
	bus                            bus.Bus
	pluginSettingsService          *pluginsSettingsServiceMock
	pluginStore                    pluginstore.Store
	pluginDashboardService         plugindashboards.Service
	importDashboardService         dashboardimport.Service
	dashboardPluginService         *dashboardPluginServiceMock
	dashboardService               *dashboardServiceMock
	importDashboardArgs            []*dashboardimport.ImportDashboardRequest
	getPluginSettingsByIdArgs      []*pluginsettings.GetPluginSettingByIdQuery
	updatePluginSettingVersionArgs []*pluginsettings.UpdatePluginSettingVersionCmd
	dashboardUpdater               *DashboardUpdater
}

func scenario(t *testing.T, desc string, input scenarioInput, f func(ctx *scenarioContext)) {
	t.Helper()

	tracer := tracing.InitializeTracerForTest()

	sCtx := &scenarioContext{
		t:                              t,
		bus:                            bus.ProvideBus(tracer),
		importDashboardArgs:            []*dashboardimport.ImportDashboardRequest{},
		getPluginSettingsByIdArgs:      []*pluginsettings.GetPluginSettingByIdQuery{},
		updatePluginSettingVersionArgs: []*pluginsettings.UpdatePluginSettingVersionCmd{},
	}

	getPlugin := func(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
		for _, p := range input.installedPlugins {
			if p.ID == pluginID {
				return p, true
			}
		}

		return pluginstore.Plugin{}, false
	}

	sCtx.pluginSettingsService = &pluginsSettingsServiceMock{
		storedPluginSettings: input.storedPluginSettings,
	}

	sCtx.pluginStore = &pluginStoreMock{
		pluginFunc: getPlugin,
	}

	pluginDashboards := map[string][]*dashboards.Dashboard{}
	for _, pluginDashboard := range input.pluginDashboards {
		if _, exists := pluginDashboards[pluginDashboard.PluginId]; !exists {
			pluginDashboards[pluginDashboard.PluginId] = []*dashboards.Dashboard{}
		}

		pluginDashboards[pluginDashboard.PluginId] = append(pluginDashboards[pluginDashboard.PluginId], &dashboards.Dashboard{
			PluginID: pluginDashboard.PluginId,
		})
	}

	sCtx.dashboardPluginService = &dashboardPluginServiceMock{
		pluginDashboards: pluginDashboards,
	}

	sCtx.dashboardService = &dashboardServiceMock{
		deleteDashboardArgs: []struct {
			orgId        int64
			dashboardId  int64
			dashboardUID string
		}{},
	}

	listPluginDashboards := func(ctx context.Context, req *plugindashboards.ListPluginDashboardsRequest) (*plugindashboards.ListPluginDashboardsResponse, error) {
		dashboards := []*plugindashboards.PluginDashboard{}

		for _, d := range input.pluginDashboards {
			if d.PluginId == req.PluginID {
				dashboards = append(dashboards, d)
			}
		}

		return &plugindashboards.ListPluginDashboardsResponse{
			Items: dashboards,
		}, nil
	}

	loadPluginDashboard := func(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error) {
		for _, d := range input.pluginDashboards {
			if d.PluginId == req.PluginID && req.Reference == d.Reference {
				return &plugindashboards.LoadPluginDashboardResponse{
					Dashboard: &dashboards.Dashboard{},
				}, nil
			}
		}

		return nil, fmt.Errorf("no match for loading plugin dashboard")
	}

	sCtx.pluginDashboardService = &pluginDashboardServiceMock{
		listPluginDashboardsFunc: listPluginDashboards,
		loadPluginDashboardfunc:  loadPluginDashboard,
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

	sCtx.dashboardUpdater = newDashboardUpdater(
		sCtx.bus,
		sCtx.pluginStore,
		sCtx.pluginDashboardService,
		sCtx.importDashboardService,
		sCtx.pluginSettingsService,
		sCtx.dashboardPluginService,
		sCtx.dashboardService,
	)

	t.Run(desc, func(t *testing.T) {
		f(sCtx)
	})
}
