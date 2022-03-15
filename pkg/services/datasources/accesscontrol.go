package datasources

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ScopeRoot = "datasources"

	ActionRead             = "datasources:read"
	ActionQuery            = "datasources:query"
	ActionCreate           = "datasources:create"
	ActionWrite            = "datasources:write"
	ActionDelete           = "datasources:delete"
	ActionIDRead           = "datasources.id:read"
	ActionPermissionsRead  = "datasources.permissions:read"
	ActionPermissionsWrite = "datasources.permissions:write"
)

var (
	ScopeID       = accesscontrol.Scope("datasources", "id", accesscontrol.Parameter(":datasourceId"))
	ScopeAll      = accesscontrol.GetResourceAllScope(ScopeRoot)
	ScopeProvider = accesscontrol.NewScopeProvider(ScopeRoot)
)
