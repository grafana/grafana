package datasources

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionDatasourcesRead             = "datasources:read"
	ActionDatasourcesQuery            = "datasources:query"
	ActionDatasourcesCreate           = "datasources:create"
	ActionDatasourcesWrite            = "datasources:write"
	ActionDatasourcesDelete           = "datasources:delete"
	ActionDatasourcesIDRead           = "datasources.id:read"
	ActionDatasourcesPermissionsRead  = "datasources.permissions:read"
	ActionDatasourcesPermissionsWrite = "datasources.permissions:write"

	ScopeDatasourcesRoot = "datasources"
)

var (
	ScopeDatasourceID        = accesscontrol.Scope("datasources", "id", accesscontrol.Parameter(":datasourceId"))
	ScopeDatasourcesAll      = accesscontrol.GetResourceAllScope(ScopeDatasourcesRoot)
	ScopeDatasourcesProvider = accesscontrol.NewScopeProvider(ScopeDatasourcesRoot)
)
