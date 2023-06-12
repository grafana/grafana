package datasources

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ScopeRoot   = "datasources"
	ScopePrefix = ScopeRoot + ":uid:"

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

var (
	// ConfigurationPageAccess is used to protect the "Configure > Data sources" tab access
	ConfigurationPageAccess = accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionDatasourcesExplore),
		accesscontrol.EvalAll(
			accesscontrol.EvalPermission(ActionRead),
			accesscontrol.EvalAny(
				accesscontrol.EvalPermission(ActionCreate),
				accesscontrol.EvalPermission(ActionDelete),
				accesscontrol.EvalPermission(ActionWrite),
			),
		),
	)

	// NewPageAccess is used to protect the "Configure > Data sources > New" page access
	NewPageAccess = accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ActionRead),
		accesscontrol.EvalPermission(ActionCreate),
	)

	// EditPageAccess is used to protect the "Configure > Data sources > Edit" page access
	EditPageAccess = accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ActionRead),
		accesscontrol.EvalPermission(ActionWrite),
	)
)
