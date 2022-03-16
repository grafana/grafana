package datasources

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionDatasourcesRead   = "datasources:read"
	ActionDatasourcesQuery  = "datasources:query"
	ActionDatasourcesCreate = "datasources:create"
	ActionDatasourcesWrite  = "datasources:write"
	ActionDatasourcesDelete = "datasources:delete"
	ActionDatasourcesIDRead = "datasources.id:read"

	ScopeDatasourcesRoot = "datasources"
)

var (
	ScopeDatasourcesAll      = accesscontrol.GetResourceAllScope(ScopeDatasourcesRoot)
	ScopeDatasourcesProvider = accesscontrol.NewScopeProvider(ScopeDatasourcesRoot)
)
