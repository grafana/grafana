package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestImportDashboardService(t *testing.T) {
	t.Run("When importing a plugin dashboard should save dashboard and sync library panels", func(t *testing.T) {
		pluginDashboardService := &pluginDashboardServiceMock{
			loadPluginDashboardFunc: loadTestDashboard,
		}

		var importDashboardArg *dashboards.SaveDashboardDTO
		dashboardService := &dashboardServiceMock{
			importDashboardFunc: func(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
				importDashboardArg = dto
				return &dashboards.Dashboard{
					ID:        4,
					UID:       dto.Dashboard.UID,
					Slug:      dto.Dashboard.Slug,
					OrgID:     3,
					Version:   dto.Dashboard.Version,
					PluginID:  "prometheus",
					FolderUID: dto.Dashboard.FolderUID,
					Title:     dto.Dashboard.Title,
					Data:      dto.Dashboard.Data,
				}, nil
			},
		}

		importLibraryPanelsForDashboard := false
		libraryPanelService := &libraryPanelServiceMock{
			importLibraryPanelsForDashboardFunc: func(ctx context.Context, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error {
				importLibraryPanelsForDashboard = true
				return nil
			},
		}
		folderService := &foldertest.FakeService{
			ExpectedFolder: &folder.Folder{
				UID: "123",
			},
		}

		s := &ImportDashboardService{
			pluginDashboardService: pluginDashboardService,
			dashboardService:       dashboardService,
			libraryPanelService:    libraryPanelService,
			folderService:          folderService,
			features:               featuremgmt.WithFeatures(),
		}

		req := &dashboardimport.ImportDashboardRequest{
			PluginId: "prometheus",
			Path:     "dashboard.json",
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "prom"},
			},
			User:      &user.SignedInUser{UserID: 2, OrgRole: org.RoleAdmin, OrgID: 3},
			FolderUid: "folderUID",
		}
		resp, err := s.ImportDashboard(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "UDdpyzz7z", resp.UID)

		userID, err := identity.IntIdentifier(importDashboardArg.User.GetID())
		require.NoError(t, err)

		require.NotNil(t, importDashboardArg)
		require.Equal(t, int64(3), importDashboardArg.OrgID)
		require.Equal(t, int64(2), userID)
		require.Equal(t, "prometheus", importDashboardArg.Dashboard.PluginID)
		require.Equal(t, "folderUID", importDashboardArg.Dashboard.FolderUID)

		panel := importDashboardArg.Dashboard.Data.Get("panels").GetIndex(0)
		require.Equal(t, "prom", panel.Get("datasource").MustString())

		require.True(t, importLibraryPanelsForDashboard)
	})

	t.Run("When importing a non-plugin dashboard should save dashboard and sync library panels", func(t *testing.T) {
		var importDashboardArg *dashboards.SaveDashboardDTO
		dashboardService := &dashboardServiceMock{
			importDashboardFunc: func(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
				importDashboardArg = dto
				return &dashboards.Dashboard{
					ID:        4,
					UID:       dto.Dashboard.UID,
					Slug:      dto.Dashboard.Slug,
					OrgID:     3,
					Version:   dto.Dashboard.Version,
					PluginID:  "prometheus",
					FolderUID: dto.Dashboard.FolderUID,
					Title:     dto.Dashboard.Title,
					Data:      dto.Dashboard.Data,
				}, nil
			},
		}
		libraryPanelService := &libraryPanelServiceMock{}
		folderService := &foldertest.FakeService{
			ExpectedFolder: &folder.Folder{
				UID: "123",
			},
		}
		s := &ImportDashboardService{
			dashboardService:    dashboardService,
			libraryPanelService: libraryPanelService,
			folderService:       folderService,
			features:            featuremgmt.WithFeatures(),
		}

		loadResp, err := loadTestDashboard(context.Background(), &plugindashboards.LoadPluginDashboardRequest{
			PluginID:  "",
			Reference: "dashboard.json",
		})
		require.NoError(t, err)

		req := &dashboardimport.ImportDashboardRequest{
			Dashboard: loadResp.Dashboard.Data,
			Path:      "plugin_dashboard.json",
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "prom"},
			},
			User:      &user.SignedInUser{UserID: 2, OrgRole: org.RoleAdmin, OrgID: 3},
			FolderUid: "folderUID",
		}
		resp, err := s.ImportDashboard(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "UDdpyzz7z", resp.UID)

		userID, err := identity.IntIdentifier(importDashboardArg.User.GetID())
		require.NoError(t, err)

		require.NotNil(t, importDashboardArg)
		require.Equal(t, int64(3), importDashboardArg.OrgID)
		require.Equal(t, int64(2), userID)
		require.Equal(t, "", importDashboardArg.Dashboard.PluginID)
		require.Equal(t, "folderUID", importDashboardArg.Dashboard.FolderUID)

		panel := importDashboardArg.Dashboard.Data.Get("panels").GetIndex(0)
		require.Equal(t, "prom", panel.Get("datasource").MustString())
	})
}

func TestInterpolateDashboardService(t *testing.T) {
	t.Run("InterpolateDashboard with plugin ID should load from plugin", func(t *testing.T) {
		pluginDashboardService := &pluginDashboardServiceMock{
			loadPluginDashboardFunc: loadTestDashboard,
		}

		s := &ImportDashboardService{
			pluginDashboardService: pluginDashboardService,
			features:               featuremgmt.WithFeatures(),
		}

		req := &dashboardimport.ImportDashboardRequest{
			PluginId: "prometheus",
			Path:     "dashboard.json",
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "prom"},
			},
		}

		result, err := s.InterpolateDashboard(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Verify datasource was interpolated
		panel := result.Get("panels").GetIndex(0)
		require.Equal(t, "prom", panel.Get("datasource").MustString())
	})

	t.Run("InterpolateDashboard with dashboard JSON should apply interpolation", func(t *testing.T) {
		s := &ImportDashboardService{
			features: featuremgmt.WithFeatures(),
		}

		// Create test dashboard with template variables
		testDashboard := simplejson.New()
		testDashboard.Set("title", "Test Community Dashboard")
		testDashboard.Set("uid", "test-uid")

		// Add __inputs section (required by template evaluator)
		inputs := []interface{}{
			map[string]interface{}{
				"name":     "DS_PROMETHEUS",
				"type":     "datasource",
				"pluginId": "prometheus",
			},
			map[string]interface{}{
				"name":     "DS_LOKI",
				"type":     "datasource",
				"pluginId": "loki",
			},
		}
		testDashboard.Set("__inputs", inputs)

		panels := []interface{}{
			map[string]interface{}{
				"id": 1,
				"datasource": map[string]interface{}{
					"uid": "${DS_PROMETHEUS}",
				},
			},
			map[string]interface{}{
				"id": 2,
				"datasource": map[string]interface{}{
					"uid": "${DS_LOKI}",
				},
			},
		}
		testDashboard.Set("panels", panels)

		req := &dashboardimport.ImportDashboardRequest{
			Dashboard: testDashboard,
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "DS_PROMETHEUS", Type: "datasource", PluginId: "prometheus", Value: "my-prometheus"},
				{Name: "DS_LOKI", Type: "datasource", PluginId: "loki", Value: "my-loki"},
			},
		}

		result, err := s.InterpolateDashboard(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, result)

		// Verify datasources were interpolated correctly
		panel1 := result.Get("panels").GetIndex(0)
		require.Equal(t, "my-prometheus", panel1.Get("datasource").Get("uid").MustString())

		panel2 := result.Get("panels").GetIndex(1)
		require.Equal(t, "my-loki", panel2.Get("datasource").Get("uid").MustString())
	})

	t.Run("InterpolateDashboard with dashboard JSON and wildcard datasource", func(t *testing.T) {
		s := &ImportDashboardService{
			features: featuremgmt.WithFeatures(),
		}

		// Create test dashboard with simple datasource reference
		testDashboard := simplejson.New()
		testDashboard.Set("title", "Test Dashboard")

		// Add __inputs section for wildcard matching
		inputs := []interface{}{
			map[string]interface{}{
				"name":     "DS_TEST",
				"type":     "datasource",
				"pluginId": "testdata",
			},
		}
		testDashboard.Set("__inputs", inputs)

		panels := []interface{}{
			map[string]interface{}{
				"id":         1,
				"datasource": "${DS_TEST}",
			},
		}
		testDashboard.Set("panels", panels)

		req := &dashboardimport.ImportDashboardRequest{
			Dashboard: testDashboard,
			Inputs: []dashboardimport.ImportDashboardInput{
				{Name: "*", Type: "datasource", Value: "default-datasource"},
			},
		}

		result, err := s.InterpolateDashboard(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, result)

		// With wildcard, it should replace any datasource template
		panel := result.Get("panels").GetIndex(0)
		datasource := panel.Get("datasource").MustString()
		// The wildcard matcher should have replaced the template
		require.NotEqual(t, "${DS_TEST}", datasource)
	})

	t.Run("InterpolateDashboard without plugin ID or dashboard should fail", func(t *testing.T) {
		s := &ImportDashboardService{
			features: featuremgmt.WithFeatures(),
		}

		req := &dashboardimport.ImportDashboardRequest{
			PluginId:  "",
			Dashboard: nil,
			Inputs:    []dashboardimport.ImportDashboardInput{},
		}

		// This should fail with validation error
		result, err := s.InterpolateDashboard(context.Background(), req)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "either PluginId or Dashboard must be provided")
	})
}

func loadTestDashboard(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error) {
	// It's safe to ignore gosec warning G304 since this is a test and arguments comes from test configuration.
	// nolint:gosec
	bytes, err := os.ReadFile(filepath.Join("testdata", req.Reference))
	if err != nil {
		return nil, err
	}

	dashboardJSON, err := simplejson.NewJson(bytes)
	if err != nil {
		return nil, err
	}

	return &plugindashboards.LoadPluginDashboardResponse{
		Dashboard: dashboards.NewDashboardFromJson(dashboardJSON),
	}, nil
}

type pluginDashboardServiceMock struct {
	plugindashboards.Service
	loadPluginDashboardFunc func(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error)
}

func (m *pluginDashboardServiceMock) LoadPluginDashboard(ctx context.Context, req *plugindashboards.LoadPluginDashboardRequest) (*plugindashboards.LoadPluginDashboardResponse, error) {
	if m.loadPluginDashboardFunc != nil {
		return m.loadPluginDashboardFunc(ctx, req)
	}

	return nil, nil
}

type dashboardServiceMock struct {
	dashboards.DashboardService
	importDashboardFunc func(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error)
}

func (s *dashboardServiceMock) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
	if s.importDashboardFunc != nil {
		return s.importDashboardFunc(ctx, dto)
	}

	return nil, nil
}

type libraryPanelServiceMock struct {
	librarypanels.Service
	connectLibraryPanelsForDashboardFunc func(c context.Context, signedInUser identity.Requester, dash *dashboards.Dashboard) error
	importLibraryPanelsForDashboardFunc  func(c context.Context, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error
}

var _ librarypanels.Service = (*libraryPanelServiceMock)(nil)

func (s *libraryPanelServiceMock) ConnectLibraryPanelsForDashboard(ctx context.Context, signedInUser identity.Requester, dash *dashboards.Dashboard) error {
	if s.connectLibraryPanelsForDashboardFunc != nil {
		return s.connectLibraryPanelsForDashboardFunc(ctx, signedInUser, dash)
	}

	return nil
}

func (s *libraryPanelServiceMock) ImportLibraryPanelsForDashboard(ctx context.Context, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error {
	if s.importLibraryPanelsForDashboardFunc != nil {
		return s.importLibraryPanelsForDashboardFunc(ctx, signedInUser, libraryPanels, panels, folderID, folderUID)
	}

	return nil
}
