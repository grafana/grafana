package notebooks

// Notebooks are a folder-scoped resource in the dashboard.grafana.app group. They have their own
// RBAC actions and (via the authz mapper) a notebooks:uid: scope, so notebook access is not
// coupled to dashboard permissions. The notebooks:* scope helpers (provider/all-scope) are added
// later with the notebook resource-permission service.
const (
	ScopeNotebooksRoot = "notebooks"
	// ScopeNotebooksAll is the wildcard object scope (mirrors dashboards.ScopeDashboardsAll). It is
	// what reaches notebooks by their own uid, including folderless (root) notebooks that no
	// folder-inherited grant covers.
	ScopeNotebooksAll = "notebooks:*"

	ActionNotebooksCreate = "notebooks:create"
	ActionNotebooksRead   = "notebooks:read"
	ActionNotebooksWrite  = "notebooks:write"
	ActionNotebooksDelete = "notebooks:delete"
)
