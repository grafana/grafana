package notebooks

// Notebooks are a folder-scoped resource in the dashboard.grafana.app group. They have their own
// RBAC actions and (via the authz mapper) a notebooks:uid: scope, so notebook access is not
// coupled to dashboard permissions. Permissions-management actions (notebooks.permissions:*) and
// the notebooks:* scope helpers are added later with the notebook resource-permission service.
const (
	ScopeNotebooksRoot = "notebooks"

	ActionNotebooksCreate = "notebooks:create"
	ActionNotebooksRead   = "notebooks:read"
	ActionNotebooksWrite  = "notebooks:write"
	ActionNotebooksDelete = "notebooks:delete"
)
