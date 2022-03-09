package dashboards

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionFoldersCreate           = "folders:create"
	ActionFoldersRead             = "folders:read"
	ActionFoldersWrite            = "folders:write"
	ActionFoldersDelete           = "folders:delete"
	ActionFoldersPermissionsRead  = "folders.permissions:read"
	ActionFoldersPermissionsWrite = "folders.permissions:write"

	ScopeFoldersRoot = "folders"
)

var (
	ScopeFoldersAll      = accesscontrol.GetResourceAllScope(ScopeFoldersRoot)
	ScopeFoldersProvider = accesscontrol.NewScopeProvider(ScopeFoldersRoot)
)
