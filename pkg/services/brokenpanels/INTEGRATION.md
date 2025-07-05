# Integration Guide

This document explains how to integrate the Broken Panels Service into Grafana.

## Wire Registration

To register the service with Grafana's dependency injection system, add the following to the appropriate wire set:

### In `pkg/server/wire.go` (for OSS)

Add the broken panels service to the `wireBasicSet`:

```go
var wireBasicSet = wire.NewSet(
    // ... existing services ...
    brokenpanels.WireSet,
    // ... other services ...
)
```

### In `pkg/server/wireexts_oss.go` (for OSS extensions)

Add the broken panels service to the `wireExtsBasicSet`:

```go
var wireExtsBasicSet = wire.NewSet(
    // ... existing services ...
    brokenpanels.WireSet,
    // ... other services ...
)
```

## API Registration

To register the API endpoints, add the following to your API registration code:

```go
// In your API registration function
func RegisterAPIs(routing.RouteRegister, brokenpanels.Service, dashboards.DashboardService) {
    api := NewBrokenPanelsAPI(brokenPanelsService, dashboardService)
    
    // Register the API routes
    r.Group("/api/brokenpanels", func(r routing.RouteRegister) {
        r.Get("/dashboard/:dashboardUID", api.FindBrokenPanelsInDashboard)
        r.Get("/org", api.FindBrokenPanelsInOrg)
        r.Post("/validate", api.ValidatePanel)
        
        // Cache management endpoints
        r.Delete("/cache/dashboard/:dashboardUID", api.InvalidateDashboardCache)
        r.Delete("/cache/org", api.InvalidateOrgCache)
        r.Delete("/cache/all", api.ClearAllCache)
    })
}
```

## Service Usage

Once registered, the service can be used throughout Grafana:

```go
// Inject the service into your component
type MyComponent struct {
    brokenPanelsService brokenpanels.Service
}

// Use the service
func (c *MyComponent) CheckDashboard(ctx context.Context, dashboardUID string) error {
    result, err := c.brokenPanelsService.FindBrokenPanels(ctx, &brokenpanels.FindBrokenPanelsQuery{
        DashboardUID: dashboardUID,
        OrgID:        1,
    })
    
    if err != nil {
        return err
    }
    
    if result.TotalCount > 0 {
        // Handle broken panels
        for _, panel := range result.BrokenPanels {
            log.Warn("Found broken panel", "panelID", panel.PanelID, "error", panel.ErrorType)
        }
    }
    
    return nil
}

// Invalidate cache when dashboard is updated
func (c *MyComponent) OnDashboardUpdate(ctx context.Context, dashboardUID string, orgID int64) {
    c.brokenPanelsService.InvalidateDashboardCache(ctx, dashboardUID, orgID)
}
```

## Testing

To test the service, you can use the provided mocks:

```go
func TestMyComponent(t *testing.T) {
    mockService := &brokenpanels.FakeBrokenPanelsService{}
    
    // Setup mock expectations
    mockService.On("FindBrokenPanels", mock.Anything, mock.Anything).Return(&brokenpanels.BrokenPanelsResult{
        TotalCount: 1,
        BrokenPanels: []*brokenpanels.BrokenPanel{
            {
                PanelID:   1,
                ErrorType: brokenpanels.ErrorTypeDatasourceNotFound,
            },
        },
    }, nil)
    
    component := &MyComponent{
        brokenPanelsService: mockService,
    }
    
    // Test your component
    err := component.CheckDashboard(context.Background(), "test-dashboard")
    assert.NoError(t, err)
    
    mockService.AssertExpectations(t)
}
```

## Configuration

The service doesn't require any special configuration as it uses existing Grafana services (dashboard service, datasource service, plugin store, localcache service).

### Cache Configuration

The service uses Grafana's localcache service with the following default settings:
- **Default TTL**: 5 minutes
- **Cleanup Interval**: 10 minutes

These settings can be configured by modifying the localcache service configuration in Grafana.

## Dependencies

The service depends on the following Grafana services:
- `dashboards.DashboardService` - to retrieve dashboard data
- `datasources.DataSourceService` - to validate datasource existence
- `pluginstore.Store` - to validate plugin availability
- `plugincontext.Provider` - for plugin context (future use)
- `localcache.CacheService` - for in-memory caching of results

These dependencies are automatically injected by the wire dependency injection system.

## Cache Management

The service provides several methods for cache management:

```go
// Invalidate cache for a specific dashboard
service.InvalidateDashboardCache(ctx, "dashboard-uid", orgID)

// Invalidate cache for an organization
service.InvalidateOrgCache(ctx, orgID)

// Clear all cache
service.ClearAll(ctx)
```

These methods are useful when dashboards or datasources are updated and you want to ensure fresh results on the next request. 