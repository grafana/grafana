// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
package accesscontrol

// all available actions for dashboards
const (
	ActionDashboardsRead             = "dashboards:read"
	ActionDashboardsWrite            = "dashboards:write"
	ActionDashboardsCreate           = "dashboards:create"
	ActionDashboardsDelete           = "dashboards:delete"
	ActionDashboardsInsightsRead     = "dashboards.insights:read"
	ActionDashboardsPermissionsRead  = "dashboards.permissions:read"
	ActionDashboardsPermissionsWrite = "dashboards.permissions:write"
	ActionDashboardsPublicWrite      = "dashboards.public:write"
)

// relevant scope stuff
const (
	ScopeDashboardsRoot   = "dashboards"
	ScopeDashboardsAll    = "dashboards:uid:*"
	ScopeDashboardsPrefix = "dashboards:uid:"
)

// all available actions for datasources
const (
	ActionDatasourcesRead             = "datasources:read"
	ActionDatasourcesQuery            = "datasources:query"
	ActionDatasourcesCreate           = "datasources:create"
	ActionDatasourcesWrite            = "datasources:write"
	ActionDatasourcesDelete           = "datasources:delete"
	ActionDatasourcesExplore          = "datasources:explore"
	ActionDatasourcesCachingRead      = "datasources.caching:read"
	ActionDatasourcesCachingWrite     = "datasources.caching:write"
	ActionDatasourcesIdRead           = "datasources.id:read"
	ActionDatasourcesInsightsRead     = "datasources.insights:read"
	ActionDatasourcesPermissionsRead  = "datasources.permissions:read"
	ActionDatasourcesPermissionsWrite = "datasources.permissions:write"
)

// relevant scope stuff
const (
	ScopeDatasourcesRoot   = "datasources"
	ScopeDatasourcesAll    = "datasources:uid:*"
	ScopeDatasourcesPrefix = "datasources:uid:"
)

// all available actions for folders
const (
	ActionFoldersRead             = "folders:read"
	ActionFoldersWrite            = "folders:write"
	ActionFoldersDelete           = "folders:delete"
	ActionFoldersCreate           = "folders:create"
	ActionFoldersPermissionsRead  = "folders.permissions:read"
	ActionFoldersPermissionsWrite = "folders.permissions:write"
)

// relevant scope stuff
const (
	ScopeFoldersRoot   = "folders"
	ScopeFoldersAll    = "folders:uid:*"
	ScopeFoldersPrefix = "folders:uid:"
)
