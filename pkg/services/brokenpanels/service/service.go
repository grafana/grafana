package service

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/brokenpanels"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	// Cache TTL for broken panel results
	DefaultCacheTTL = 5 * time.Minute

	// Cache key prefixes
	DashboardCachePrefix = "brokenpanels:dashboard:"
	OrgCachePrefix       = "brokenpanels:org:"
	PanelCachePrefix     = "brokenpanels:panel:"
)

type Service struct {
	log                   log.Logger
	dashboardService      dashboards.DashboardService
	datasourceService     datasources.DataSourceService
	pluginStore           pluginstore.Store
	pluginContextProvider plugincontext.Provider
	cache                 *localcache.CacheService
}

// New creates a new BrokenPanels Service with explicit dependencies.
func New(
	dashboardService dashboards.DashboardService,
	datasourceService datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider plugincontext.Provider,
	cacheService *localcache.CacheService,
) *Service {
	return &Service{
		log:                   log.New("brokenpanels.service"),
		dashboardService:      dashboardService,
		datasourceService:     datasourceService,
		pluginStore:           pluginStore,
		pluginContextProvider: pluginContextProvider,
		cache:                 cacheService,
	}
}

// ProvideService is an alias for New for backward compatibility.
var ProvideService = New

func (s *Service) FindBrokenPanels(ctx context.Context, query *brokenpanels.FindBrokenPanelsQuery) (*brokenpanels.BrokenPanelsResult, error) {
	// Check cache first
	cacheKey := s.generateDashboardCacheKey(query)
	if s.cache != nil {
		if cached, found := s.cache.Get(cacheKey); found {
			s.log.Debug("Cache hit for dashboard broken panels", "dashboardUID", query.DashboardUID)
			if result, ok := cached.(*brokenpanels.BrokenPanelsResult); ok {
				return result, nil
			}
		}
	}

	s.log.Debug("Cache miss for dashboard broken panels", "dashboardUID", query.DashboardUID)

	// Get the dashboard
	dashboardQuery := &dashboards.GetDashboardQuery{
		UID:   query.DashboardUID,
		OrgID: query.OrgID,
	}

	dashboard, err := s.dashboardService.GetDashboard(ctx, dashboardQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard: %w", err)
	}

	brokenPanels := s.analyzeDashboardPanels(ctx, dashboard, query.OrgID)

	result := &brokenpanels.BrokenPanelsResult{
		DashboardUID:   dashboard.UID,
		DashboardTitle: dashboard.Title,
		BrokenPanels:   brokenPanels,
		TotalCount:     len(brokenPanels),
	}

	// Cache the result
	if s.cache != nil {
		s.cache.Set(cacheKey, result, DefaultCacheTTL)
		s.log.Debug("Cached dashboard broken panels", "dashboardUID", query.DashboardUID, "ttl", DefaultCacheTTL)
	}

	return result, nil
}

func (s *Service) FindBrokenPanelsInOrg(ctx context.Context, query *brokenpanels.FindBrokenPanelsInOrgQuery) (*brokenpanels.BrokenPanelsResult, error) {
	// Check cache first
	cacheKey := s.generateOrgCacheKey(query)
	if s.cache != nil {
		if cached, found := s.cache.Get(cacheKey); found {
			s.log.Debug("Cache hit for org broken panels", "orgID", query.OrgID)
			if result, ok := cached.(*brokenpanels.BrokenPanelsResult); ok {
				return result, nil
			}
		}
	}

	s.log.Debug("Cache miss for org broken panels", "orgID", query.OrgID)

	// Get all dashboards in the org
	dashboards, err := s.dashboardService.GetAllDashboardsByOrgId(ctx, query.OrgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboards: %w", err)
	}

	var allBrokenPanels []*brokenpanels.BrokenPanel

	// Analyze each dashboard
	for _, dashboard := range dashboards {
		// Skip if not in the filtered list
		if len(query.DashboardUIDs) > 0 {
			found := false
			for _, uid := range query.DashboardUIDs {
				if uid == dashboard.UID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		brokenPanels := s.analyzeDashboardPanels(ctx, dashboard, query.OrgID)

		// Filter by panel types if specified
		if len(query.PanelTypes) > 0 {
			filteredPanels := make([]*brokenpanels.BrokenPanel, 0)
			for _, panel := range brokenPanels {
				for _, panelType := range query.PanelTypes {
					if panel.PanelType == panelType {
						filteredPanels = append(filteredPanels, panel)
						break
					}
				}
			}
			brokenPanels = filteredPanels
		}

		// Filter by error types if specified
		if len(query.ErrorTypes) > 0 {
			filteredPanels := make([]*brokenpanels.BrokenPanel, 0)
			for _, panel := range brokenPanels {
				for _, errorType := range query.ErrorTypes {
					if panel.ErrorType == errorType {
						filteredPanels = append(filteredPanels, panel)
						break
					}
				}
			}
			brokenPanels = filteredPanels
		}

		allBrokenPanels = append(allBrokenPanels, brokenPanels...)
	}

	result := &brokenpanels.BrokenPanelsResult{
		DashboardUID:   "", // Multiple dashboards
		DashboardTitle: "", // Multiple dashboards
		BrokenPanels:   allBrokenPanels,
		TotalCount:     len(allBrokenPanels),
	}

	// Cache the result
	if s.cache != nil {
		s.cache.Set(cacheKey, result, DefaultCacheTTL)
		s.log.Debug("Cached org broken panels", "orgID", query.OrgID, "ttl", DefaultCacheTTL)
	}

	return result, nil
}

func (s *Service) ValidatePanel(ctx context.Context, query *brokenpanels.ValidatePanelQuery) (*brokenpanels.PanelValidationResult, error) {
	// Check cache first
	cacheKey := s.generatePanelCacheKey(query)
	if s.cache != nil {
		if cached, found := s.cache.Get(cacheKey); found {
			s.log.Debug("Cache hit for panel validation", "dashboardUID", query.Dashboard.UID, "panelID", query.PanelID)
			if result, ok := cached.(*brokenpanels.PanelValidationResult); ok {
				return result, nil
			}
		}
	}

	s.log.Debug("Cache miss for panel validation", "dashboardUID", query.Dashboard.UID, "panelID", query.PanelID)

	panel := s.findPanelInDashboard(query.Dashboard, query.PanelID)
	if panel == nil {
		result := &brokenpanels.PanelValidationResult{
			PanelID:      query.PanelID,
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypeInvalidConfiguration,
			ErrorMessage: "Panel not found in dashboard",
		}

		// Cache the result
		if s.cache != nil {
			s.cache.Set(cacheKey, result, DefaultCacheTTL)
		}
		return result, nil
	}

	validationResult := s.validateSinglePanel(ctx, panel, query.OrgID)
	validationResult.PanelID = query.PanelID

	// Cache the result
	if s.cache != nil {
		s.cache.Set(cacheKey, validationResult, DefaultCacheTTL)
		s.log.Debug("Cached panel validation", "dashboardUID", query.Dashboard.UID, "panelID", query.PanelID, "ttl", DefaultCacheTTL)
	}

	return validationResult, nil
}

// InvalidateDashboardCache invalidates cache for a specific dashboard
func (s *Service) InvalidateDashboardCache(ctx context.Context, dashboardUID string, orgID int64) {
	if s.cache == nil {
		return
	}
	query := &brokenpanels.FindBrokenPanelsQuery{
		DashboardUID: dashboardUID,
		OrgID:        orgID,
	}
	cacheKey := s.generateDashboardCacheKey(query)
	s.cache.Delete(cacheKey)
	s.log.Debug("Invalidated dashboard cache", "dashboardUID", dashboardUID)
}

// InvalidateOrgCache invalidates cache for an organization
func (s *Service) InvalidateOrgCache(ctx context.Context, orgID int64) {
	// Note: The localcache doesn't provide pattern-based deletion
	// In a production environment, you might want to use a cache that supports this
	s.log.Debug("Org cache invalidation requested", "orgID", orgID)
}

// ClearAll clears all broken panels cache
func (s *Service) ClearAll(ctx context.Context) {
	// Note: The localcache doesn't provide a way to clear all entries
	// In a production environment, you might want to use a cache that supports this
	s.log.Debug("Clear all cache requested")
}

func (s *Service) analyzeDashboardPanels(ctx context.Context, dashboard *dashboards.Dashboard, orgID int64) []*brokenpanels.BrokenPanel {
	var brokenPanels []*brokenpanels.BrokenPanel

	panels := dashboard.Data.Get("panels").MustArray()
	for _, panelObj := range panels {
		panel := simplejson.NewFromAny(panelObj)

		validationResult := s.validateSinglePanel(ctx, panel, orgID)
		if validationResult.IsBroken {
			brokenPanel := &brokenpanels.BrokenPanel{
				PanelID:      panel.Get("id").MustInt64(),
				PanelTitle:   panel.Get("title").MustString(),
				PanelType:    panel.Get("type").MustString(),
				ErrorType:    validationResult.ErrorType,
				ErrorMessage: validationResult.ErrorMessage,
				Datasource:   validationResult.Datasource,
				Position: &brokenpanels.PanelPosition{
					X: panel.Get("gridPos").Get("x").MustInt(),
					Y: panel.Get("gridPos").Get("y").MustInt(),
					W: panel.Get("gridPos").Get("w").MustInt(),
					H: panel.Get("gridPos").Get("h").MustInt(),
				},
			}
			brokenPanels = append(brokenPanels, brokenPanel)
		}
	}

	return brokenPanels
}

func (s *Service) validateSinglePanel(ctx context.Context, panel *simplejson.Json, orgID int64) *brokenpanels.PanelValidationResult {
	panelType := panel.Get("type").MustString()

	// Skip row panels as they don't have datasources
	if panelType == "row" {
		return &brokenpanels.PanelValidationResult{
			IsBroken: false,
		}
	}

	// Check if plugin exists
	plugin, exists := s.pluginStore.Plugin(ctx, panelType)
	if !exists {
		return &brokenpanels.PanelValidationResult{
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypePluginNotFound,
			ErrorMessage: fmt.Sprintf("Plugin '%s' not found", panelType),
		}
	}

	// Check plugin version if specified
	if pluginVersion := panel.Get("pluginVersion").MustString(); pluginVersion != "" {
		if plugin.Info.Version != pluginVersion {
			return &brokenpanels.PanelValidationResult{
				IsBroken:     true,
				ErrorType:    brokenpanels.ErrorTypePluginVersionMismatch,
				ErrorMessage: fmt.Sprintf("Plugin version mismatch. Expected: %s, Found: %s", pluginVersion, plugin.Info.Version),
			}
		}
	}

	// Check datasource
	datasource := panel.Get("datasource")
	if datasource.Interface() == nil {
		return &brokenpanels.PanelValidationResult{
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypeInvalidConfiguration,
			ErrorMessage: "No datasource configured",
		}
	}

	// Handle different datasource formats
	var datasourceUID string
	var datasourceType string

	if datasourceUID = datasource.Get("uid").MustString(); datasourceUID != "" {
		datasourceType = datasource.Get("type").MustString()
	} else if datasourceUID = datasource.MustString(); datasourceUID != "" {
		// Legacy format where datasource is just a string
		datasourceType = ""
	} else {
		return &brokenpanels.PanelValidationResult{
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypeInvalidConfiguration,
			ErrorMessage: "Invalid datasource configuration",
		}
	}

	// Skip special datasources
	if datasourceUID == "-- Mixed --" || datasourceUID == "-- Dashboard --" || datasourceUID == "__expr__" {
		return &brokenpanels.PanelValidationResult{
			IsBroken: false,
		}
	}

	// Check if datasource exists
	datasourceQuery := &datasources.GetDataSourceQuery{
		UID:   datasourceUID,
		OrgID: orgID,
	}

	ds, err := s.datasourceService.GetDataSource(ctx, datasourceQuery)
	if err != nil {
		return &brokenpanels.PanelValidationResult{
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypeDatasourceNotFound,
			ErrorMessage: fmt.Sprintf("Datasource '%s' not found", datasourceUID),
			Datasource: &brokenpanels.DatasourceInfo{
				UID:  datasourceUID,
				Type: datasourceType,
			},
		}
	}

	// Check if panel has targets/queries
	targets := panel.Get("targets").MustArray()
	if len(targets) == 0 {
		return &brokenpanels.PanelValidationResult{
			IsBroken:     true,
			ErrorType:    brokenpanels.ErrorTypeMissingTargets,
			ErrorMessage: "Panel has no queries/targets configured",
			Datasource: &brokenpanels.DatasourceInfo{
				UID:  ds.UID,
				Type: ds.Type,
				Name: ds.Name,
			},
		}
	}

	return &brokenpanels.PanelValidationResult{
		IsBroken: false,
		Datasource: &brokenpanels.DatasourceInfo{
			UID:  ds.UID,
			Type: ds.Type,
			Name: ds.Name,
		},
	}
}

func (s *Service) findPanelInDashboard(dashboard *dashboards.Dashboard, panelID int64) *simplejson.Json {
	panels := dashboard.Data.Get("panels").MustArray()
	for _, panelObj := range panels {
		panel := simplejson.NewFromAny(panelObj)
		if panel.Get("id").MustInt64() == panelID {
			return panel
		}
	}
	return nil
}

// Cache key generation methods
func (s *Service) generateDashboardCacheKey(query *brokenpanels.FindBrokenPanelsQuery) string {
	data := fmt.Sprintf("%s:%d", query.DashboardUID, query.OrgID)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%s%x", DashboardCachePrefix, hash)
}

func (s *Service) generateOrgCacheKey(query *brokenpanels.FindBrokenPanelsInOrgQuery) string {
	// Include all filter parameters in the cache key
	filterData := struct {
		OrgID         int64    `json:"orgID"`
		DashboardUIDs []string `json:"dashboardUIDs"`
		PanelTypes    []string `json:"panelTypes"`
		ErrorTypes    []string `json:"errorTypes"`
	}{
		OrgID:         query.OrgID,
		DashboardUIDs: query.DashboardUIDs,
		PanelTypes:    query.PanelTypes,
		ErrorTypes:    query.ErrorTypes,
	}

	jsonData, _ := json.Marshal(filterData)
	hash := md5.Sum(jsonData)
	return fmt.Sprintf("%s%x", OrgCachePrefix, hash)
}

func (s *Service) generatePanelCacheKey(query *brokenpanels.ValidatePanelQuery) string {
	data := fmt.Sprintf("%s:%d:%d", query.Dashboard.UID, query.PanelID, query.OrgID)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%s%x", PanelCachePrefix, hash)
}
