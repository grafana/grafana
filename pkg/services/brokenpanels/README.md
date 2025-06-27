# Broken Panels Service

The Broken Panels Service is a new service in Grafana that helps identify and diagnose broken panels in dashboards. It analyzes dashboard panels to detect various issues that can cause panels to fail or display incorrectly.

## Features

- **Find broken panels in a specific dashboard**: Analyze all panels in a dashboard and identify those with issues
- **Find broken panels across an organization**: Scan all dashboards in an organization to find broken panels
- **Validate individual panels**: Check if a specific panel is working correctly
- **Multiple error detection**: Identifies various types of panel issues
- **Browser memory caching**: Caches results for improved performance

## Caching

The service uses Grafana's localcache service to cache broken panel results in memory. This improves performance by avoiding repeated analysis of the same dashboards and panels.

### Cache Behavior

- **Cache TTL**: 5 minutes by default
- **Cache Keys**: Generated using MD5 hashes of query parameters to ensure uniqueness
- **Cache Invalidation**: Manual invalidation through API endpoints
- **Cache Scope**: Per-organization and per-dashboard

### Cache Endpoints

#### Invalidate Dashboard Cache
```
DELETE /api/brokenpanels/cache/dashboard/{dashboardUID}
```

Invalidates cache for a specific dashboard.

#### Invalidate Organization Cache
```
DELETE /api/brokenpanels/cache/org
```

Invalidates cache for the current organization.

#### Clear All Cache
```
DELETE /api/brokenpanels/cache/all
```

Clears all broken panels cache.

## Error Types Detected

The service can detect the following types of broken panels:

- **`datasource_not_found`**: Panel references a datasource that doesn't exist
- **`datasource_access_denied`**: Panel references a datasource that the user doesn't have access to
- **`plugin_not_found`**: Panel uses a plugin that is not installed or available
- **`plugin_version_mismatch`**: Panel uses a plugin version that doesn't match the installed version
- **`invalid_query`**: Panel has invalid query configuration
- **`missing_targets`**: Panel has no queries or targets configured
- **`invalid_configuration`**: Panel has invalid or missing configuration

## API Endpoints

### Find Broken Panels in Dashboard
```
GET /api/brokenpanels/dashboard/{dashboardUID}
```

Returns all broken panels in a specific dashboard.

### Find Broken Panels in Organization
```
GET /api/brokenpanels/org?dashboardUIDs=uid1,uid2&panelTypes=graph,table&errorTypes=datasource_not_found
```

Returns broken panels across all dashboards in an organization with optional filtering.

Query parameters:
- `dashboardUIDs`: Comma-separated list of dashboard UIDs to filter by
- `panelTypes`: Comma-separated list of panel types to filter by
- `errorTypes`: Comma-separated list of error types to filter by

### Validate Panel
```
POST /api/brokenpanels/validate
```

Validates a specific panel in a dashboard.

Request body:
```json
{
  "dashboardUID": "dashboard-uid",
  "panelID": 1
}
```

## Usage Examples

### Using the Service Directly

```go
// Find broken panels in a specific dashboard
query := &brokenpanels.FindBrokenPanelsQuery{
    DashboardUID: "my-dashboard",
    OrgID:        1,
}
result, err := brokenPanelsService.FindBrokenPanels(ctx, query)

// Find broken panels across an organization
query := &brokenpanels.FindBrokenPanelsInOrgQuery{
    OrgID: 1,
    ErrorTypes: []string{"datasource_not_found", "plugin_not_found"},
}
result, err := brokenPanelsService.FindBrokenPanelsInOrg(ctx, query)

// Validate a specific panel
query := &brokenpanels.ValidatePanelQuery{
    Dashboard: dashboard,
    PanelID:   1,
    OrgID:     1,
}
result, err := brokenPanelsService.ValidatePanel(ctx, query)

// Invalidate cache for a dashboard
brokenPanelsService.InvalidateDashboardCache(ctx, "my-dashboard", 1)
```

### Using the API

```bash
# Find broken panels in a dashboard
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/brokenpanels/dashboard/my-dashboard"

# Find broken panels in organization with filters
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/brokenpanels/org?errorTypes=datasource_not_found,plugin_not_found"

# Validate a specific panel
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dashboardUID": "my-dashboard", "panelID": 1}' \
  "http://localhost:3000/api/brokenpanels/validate"

# Invalidate cache for a dashboard
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/brokenpanels/cache/dashboard/my-dashboard"

# Invalidate cache for organization
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/brokenpanels/cache/org"

# Clear all cache
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/brokenpanels/cache/all"
```

## Response Format

### Broken Panels Result
```json
{
  "dashboardUID": "my-dashboard",
  "dashboardTitle": "My Dashboard",
  "brokenPanels": [
    {
      "panelID": 1,
      "panelTitle": "Broken Panel",
      "panelType": "graph",
      "errorType": "datasource_not_found",
      "errorMessage": "Datasource 'missing-ds' not found",
      "datasource": {
        "uid": "missing-ds",
        "type": "prometheus",
        "name": "Missing Datasource"
      },
      "position": {
        "x": 0,
        "y": 0,
        "w": 12,
        "h": 8
      }
    }
  ],
  "totalCount": 1
}
```

### Panel Validation Result
```json
{
  "panelID": 1,
  "isBroken": true,
  "errorType": "datasource_not_found",
  "errorMessage": "Datasource 'missing-ds' not found",
  "datasource": {
    "uid": "missing-ds",
    "type": "prometheus",
    "name": "Missing Datasource"
  }
}
```

## Architecture

The service follows Grafana's standard service architecture:

- **Interface**: `pkg/services/brokenpanels/brokenpanels.go` - Defines the service interface and data structures
- **Implementation**: `pkg/services/brokenpanels/service/service.go` - Contains the main service logic with caching
- **API**: `pkg/api/brokenpanels.go` - REST API endpoints including cache management
- **Store**: `pkg/services/brokenpanels/database/store.go` - Database operations (currently minimal)
- **Tests**: `pkg/services/brokenpanels/service/service_test.go` - Unit tests including cache tests

## Dependencies

The service depends on:
- Dashboard Service - to retrieve dashboard data
- Datasource Service - to validate datasource existence and access
- Plugin Store - to validate plugin availability and versions
- LocalCache Service - for in-memory caching of results

## Future Enhancements

Potential future improvements:
- Configurable cache TTL per organization
- Background scanning and notification system
- Integration with dashboard health checks
- Support for custom validation rules
- Dashboard repair suggestions
- Historical tracking of broken panels
- Cache metrics and monitoring
- Distributed caching support (Redis/Memcached) 