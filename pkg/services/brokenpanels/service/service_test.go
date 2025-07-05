package service

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/brokenpanels"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestService_FindBrokenPanels(t *testing.T) {
	tests := []struct {
		name           string
		dashboard      *dashboards.Dashboard
		datasources    []*datasources.DataSource
		plugins        []pluginstore.Plugin
		expectedResult *brokenpanels.BrokenPanelsResult
		expectedError  bool
	}{
		{
			name: "should find broken panel with missing datasource",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    1,
					"title": "Broken Panel",
					"type":  "graph",
					"datasource": map[string]interface{}{
						"uid": "missing-datasource",
					},
					"gridPos": map[string]interface{}{
						"x": 0, "y": 0, "w": 12, "h": 8,
					},
					"targets": []interface{}{},
				},
			}),
			datasources: []*datasources.DataSource{},
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
			expectedResult: &brokenpanels.BrokenPanelsResult{
				DashboardUID:   "test-dashboard",
				DashboardTitle: "Test Dashboard",
				TotalCount:     1,
				BrokenPanels: []*brokenpanels.BrokenPanel{
					{
						PanelID:      1,
						PanelTitle:   "Broken Panel",
						PanelType:    "graph",
						ErrorType:    brokenpanels.ErrorTypeDatasourceNotFound,
						ErrorMessage: "Datasource 'missing-datasource' not found",
						Datasource: &brokenpanels.DatasourceInfo{
							UID:  "missing-datasource",
							Type: "",
						},
						Position: &brokenpanels.PanelPosition{
							X: 0, Y: 0, W: 12, H: 8,
						},
					},
				},
			},
		},
		{
			name: "should find broken panel with missing plugin",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    2,
					"title": "Broken Plugin Panel",
					"type":  "non-existent-plugin",
					"datasource": map[string]interface{}{
						"uid": "test-datasource",
					},
					"gridPos": map[string]interface{}{
						"x": 0, "y": 0, "w": 12, "h": 8,
					},
					"targets": []interface{}{},
				},
			}),
			datasources: []*datasources.DataSource{
				{
					UID:  "test-datasource",
					Type: "test",
					Name: "Test Datasource",
				},
			},
			plugins: []pluginstore.Plugin{},
			expectedResult: &brokenpanels.BrokenPanelsResult{
				DashboardUID:   "test-dashboard",
				DashboardTitle: "Test Dashboard",
				TotalCount:     1,
				BrokenPanels: []*brokenpanels.BrokenPanel{
					{
						PanelID:      2,
						PanelTitle:   "Broken Plugin Panel",
						PanelType:    "non-existent-plugin",
						ErrorType:    brokenpanels.ErrorTypePluginNotFound,
						ErrorMessage: "Plugin 'non-existent-plugin' not found",
						Position: &brokenpanels.PanelPosition{
							X: 0, Y: 0, W: 12, H: 8,
						},
					},
				},
			},
		},
		{
			name: "should find broken panel with missing targets",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    3,
					"title": "Panel Without Targets",
					"type":  "graph",
					"datasource": map[string]interface{}{
						"uid": "test-datasource",
					},
					"gridPos": map[string]interface{}{
						"x": 0, "y": 0, "w": 12, "h": 8,
					},
					"targets": []interface{}{},
				},
			}),
			datasources: []*datasources.DataSource{
				{
					UID:  "test-datasource",
					Type: "test",
					Name: "Test Datasource",
				},
			},
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
			expectedResult: &brokenpanels.BrokenPanelsResult{
				DashboardUID:   "test-dashboard",
				DashboardTitle: "Test Dashboard",
				TotalCount:     1,
				BrokenPanels: []*brokenpanels.BrokenPanel{
					{
						PanelID:      3,
						PanelTitle:   "Panel Without Targets",
						PanelType:    "graph",
						ErrorType:    brokenpanels.ErrorTypeMissingTargets,
						ErrorMessage: "Panel has no queries/targets configured",
						Datasource: &brokenpanels.DatasourceInfo{
							UID:  "test-datasource",
							Type: "test",
							Name: "Test Datasource",
						},
						Position: &brokenpanels.PanelPosition{
							X: 0, Y: 0, W: 12, H: 8,
						},
					},
				},
			},
		},
		{
			name: "should not flag row panels as broken",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    4,
					"title": "Row Panel",
					"type":  "row",
					"gridPos": map[string]interface{}{
						"x": 0, "y": 0, "w": 24, "h": 1,
					},
				},
			}),
			datasources: []*datasources.DataSource{},
			plugins:     []pluginstore.Plugin{},
			expectedResult: &brokenpanels.BrokenPanelsResult{
				DashboardUID:   "test-dashboard",
				DashboardTitle: "Test Dashboard",
				TotalCount:     0,
				BrokenPanels:   []*brokenpanels.BrokenPanel{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockDashboardService := &dashboards.FakeDashboardService{}
			mockDashboardService.On("GetDashboard", mock.Anything, mock.Anything).Return(tt.dashboard, nil)

			mockDatasourceService := &fakeDatasources.FakeDataSourceService{
				DataSources: tt.datasources,
			}

			mockPluginStore := &pluginstore.FakePluginStore{
				PluginList: tt.plugins,
			}

			cfg := setting.NewCfg()
			mockPluginContextProvider := plugincontext.ProvideService(cfg, nil, mockPluginStore, nil, mockDatasourceService, nil, nil)

			// Create cache service for testing
			cacheService := localcache.New(5*time.Minute, 10*time.Minute)

			service := ProvideService(
				mockDashboardService,
				mockDatasourceService,
				mockPluginStore,
				*mockPluginContextProvider,
				cacheService,
			)

			result, err := service.FindBrokenPanels(context.Background(), &brokenpanels.FindBrokenPanelsQuery{
				DashboardUID: tt.dashboard.UID,
				OrgID:        1,
			})

			if tt.expectedError {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedResult.DashboardUID, result.DashboardUID)
			assert.Equal(t, tt.expectedResult.DashboardTitle, result.DashboardTitle)
			assert.Equal(t, tt.expectedResult.TotalCount, result.TotalCount)
			assert.Len(t, result.BrokenPanels, len(tt.expectedResult.BrokenPanels))

			for i, expectedPanel := range tt.expectedResult.BrokenPanels {
				actualPanel := result.BrokenPanels[i]
				assert.Equal(t, expectedPanel.PanelID, actualPanel.PanelID)
				assert.Equal(t, expectedPanel.PanelTitle, actualPanel.PanelTitle)
				assert.Equal(t, expectedPanel.PanelType, actualPanel.PanelType)
				assert.Equal(t, expectedPanel.ErrorType, actualPanel.ErrorType)
				assert.Equal(t, expectedPanel.ErrorMessage, actualPanel.ErrorMessage)
			}
		})
	}
}

func TestService_Caching(t *testing.T) {
	t.Run("should cache and retrieve dashboard broken panels", func(t *testing.T) {
		dashboard := createTestDashboard("test-dashboard", []map[string]interface{}{
			{
				"id":    1,
				"title": "Broken Panel",
				"type":  "graph",
				"datasource": map[string]interface{}{
					"uid": "missing-datasource",
				},
				"gridPos": map[string]interface{}{
					"x": 0, "y": 0, "w": 12, "h": 8,
				},
				"targets": []interface{}{},
			},
		})

		mockDashboardService := &dashboards.FakeDashboardService{}
		mockDashboardService.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil).Once()

		mockDatasourceService := &fakeDatasources.FakeDataSourceService{
			DataSources: []*datasources.DataSource{},
		}

		mockPluginStore := &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
		}

		cfg := setting.NewCfg()
		mockPluginContextProvider := plugincontext.ProvideService(cfg, nil, mockPluginStore, nil, mockDatasourceService, nil, nil)

		// Create cache service for testing
		cacheService := localcache.New(5*time.Minute, 10*time.Minute)

		service := ProvideService(
			mockDashboardService,
			mockDatasourceService,
			mockPluginStore,
			*mockPluginContextProvider,
			cacheService,
		)

		query := &brokenpanels.FindBrokenPanelsQuery{
			DashboardUID: dashboard.UID,
			OrgID:        1,
		}

		// First call should hit the database
		result1, err := service.FindBrokenPanels(context.Background(), query)
		assert.NoError(t, err)
		assert.Equal(t, 1, result1.TotalCount)

		// Second call should hit the cache
		result2, err := service.FindBrokenPanels(context.Background(), query)
		assert.NoError(t, err)
		assert.Equal(t, 1, result2.TotalCount)

		// Verify that the dashboard service was only called once
		mockDashboardService.AssertNumberOfCalls(t, "GetDashboard", 1)
	})

	t.Run("should invalidate dashboard cache", func(t *testing.T) {
		dashboard := createTestDashboard("test-dashboard", []map[string]interface{}{
			{
				"id":    1,
				"title": "Broken Panel",
				"type":  "graph",
				"datasource": map[string]interface{}{
					"uid": "missing-datasource",
				},
				"gridPos": map[string]interface{}{
					"x": 0, "y": 0, "w": 12, "h": 8,
				},
				"targets": []interface{}{},
			},
		})

		mockDashboardService := &dashboards.FakeDashboardService{}
		mockDashboardService.On("GetDashboard", mock.Anything, mock.Anything).Return(dashboard, nil).Twice()

		mockDatasourceService := &fakeDatasources.FakeDataSourceService{
			DataSources: []*datasources.DataSource{},
		}

		mockPluginStore := &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
		}

		cfg := setting.NewCfg()
		mockPluginContextProvider := plugincontext.ProvideService(cfg, nil, mockPluginStore, nil, mockDatasourceService, nil, nil)

		// Create cache service for testing
		cacheService := localcache.New(5*time.Minute, 10*time.Minute)

		service := ProvideService(
			mockDashboardService,
			mockDatasourceService,
			mockPluginStore,
			*mockPluginContextProvider,
			cacheService,
		)

		query := &brokenpanels.FindBrokenPanelsQuery{
			DashboardUID: dashboard.UID,
			OrgID:        1,
		}

		// First call should hit the database
		result1, err := service.FindBrokenPanels(context.Background(), query)
		assert.NoError(t, err)
		assert.Equal(t, 1, result1.TotalCount)

		// Invalidate cache
		service.InvalidateDashboardCache(context.Background(), dashboard.UID, 1)

		// Second call should hit the database again due to cache invalidation
		result2, err := service.FindBrokenPanels(context.Background(), query)
		assert.NoError(t, err)
		assert.Equal(t, 1, result2.TotalCount)

		// Verify that the dashboard service was called twice
		mockDashboardService.AssertNumberOfCalls(t, "GetDashboard", 2)
	})
}

func TestService_ValidatePanel(t *testing.T) {
	tests := []struct {
		name           string
		dashboard      *dashboards.Dashboard
		panelID        int64
		datasources    []*datasources.DataSource
		plugins        []pluginstore.Plugin
		expectedResult *brokenpanels.PanelValidationResult
	}{
		{
			name: "should validate working panel",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    1,
					"title": "Working Panel",
					"type":  "graph",
					"datasource": map[string]interface{}{
						"uid": "test-datasource",
					},
					"targets": []interface{}{
						map[string]interface{}{
							"expr": "up",
						},
					},
				},
			}),
			panelID: 1,
			datasources: []*datasources.DataSource{
				{
					UID:  "test-datasource",
					Type: "test",
					Name: "Test Datasource",
				},
			},
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
			expectedResult: &brokenpanels.PanelValidationResult{
				PanelID:  1,
				IsBroken: false,
				Datasource: &brokenpanels.DatasourceInfo{
					UID:  "test-datasource",
					Type: "test",
					Name: "Test Datasource",
				},
			},
		},
		{
			name: "should validate broken panel with missing datasource",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    2,
					"title": "Broken Panel",
					"type":  "graph",
					"datasource": map[string]interface{}{
						"uid": "missing-datasource",
					},
					"targets": []interface{}{},
				},
			}),
			panelID:     2,
			datasources: []*datasources.DataSource{},
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
			expectedResult: &brokenpanels.PanelValidationResult{
				PanelID:      2,
				IsBroken:     true,
				ErrorType:    brokenpanels.ErrorTypeDatasourceNotFound,
				ErrorMessage: "Datasource 'missing-datasource' not found",
				Datasource: &brokenpanels.DatasourceInfo{
					UID:  "missing-datasource",
					Type: "",
				},
			},
		},
		{
			name: "should validate non-existent panel",
			dashboard: createTestDashboard("test-dashboard", []map[string]interface{}{
				{
					"id":    3,
					"title": "Existing Panel",
					"type":  "graph",
					"datasource": map[string]interface{}{
						"uid": "test-datasource",
					},
					"targets": []interface{}{},
				},
			}),
			panelID: 999,
			datasources: []*datasources.DataSource{
				{
					UID:  "test-datasource",
					Type: "test",
					Name: "Test Datasource",
				},
			},
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "graph",
						Type: "panel",
					},
				},
			},
			expectedResult: &brokenpanels.PanelValidationResult{
				PanelID:      999,
				IsBroken:     true,
				ErrorType:    brokenpanels.ErrorTypeInvalidConfiguration,
				ErrorMessage: "Panel not found in dashboard",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockDashboardService := &dashboards.FakeDashboardService{}
			mockDashboardService.On("GetDashboard", mock.Anything, mock.Anything).Return(tt.dashboard, nil)

			mockDatasourceService := &fakeDatasources.FakeDataSourceService{
				DataSources: tt.datasources,
			}

			mockPluginStore := &pluginstore.FakePluginStore{
				PluginList: tt.plugins,
			}

			cfg := setting.NewCfg()
			mockPluginContextProvider := plugincontext.ProvideService(cfg, nil, mockPluginStore, nil, mockDatasourceService, nil, nil)

			// Create cache service for testing
			cacheService := localcache.New(5*time.Minute, 10*time.Minute)

			service := ProvideService(
				mockDashboardService,
				mockDatasourceService,
				mockPluginStore,
				*mockPluginContextProvider,
				cacheService,
			)

			result, err := service.ValidatePanel(context.Background(), &brokenpanels.ValidatePanelQuery{
				Dashboard: tt.dashboard,
				PanelID:   tt.panelID,
				OrgID:     1,
			})

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedResult.PanelID, result.PanelID)
			assert.Equal(t, tt.expectedResult.IsBroken, result.IsBroken)
			assert.Equal(t, tt.expectedResult.ErrorType, result.ErrorType)
			assert.Equal(t, tt.expectedResult.ErrorMessage, result.ErrorMessage)

			if tt.expectedResult.Datasource != nil {
				assert.NotNil(t, result.Datasource)
				assert.Equal(t, tt.expectedResult.Datasource.UID, result.Datasource.UID)
				assert.Equal(t, tt.expectedResult.Datasource.Type, result.Datasource.Type)
				assert.Equal(t, tt.expectedResult.Datasource.Name, result.Datasource.Name)
			}
		})
	}
}

func createTestDashboard(uid string, panels []map[string]interface{}) *dashboards.Dashboard {
	dashboardData := simplejson.New()
	dashboardData.Set("panels", panels)

	return &dashboards.Dashboard{
		UID:   uid,
		Title: "Test Dashboard",
		Data:  dashboardData,
	}
}
