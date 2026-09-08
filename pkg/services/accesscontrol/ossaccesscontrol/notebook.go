package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/notebooks"
)

// Notebook action sets mirror the dashboard ones (view/edit), minus annotations which notebooks
// don't have. notebooks:create is folder-scoped, so it lives in FolderEditActions (see folder.go)
// rather than here, matching how dashboards:create is handled. There are no notebook-specific admin
// actions (no per-notebook permissions management), so Admin equals Edit. The trash folder-admin
// check is handled in the mapper via a set_permissions -> folders:admin route, not a granted action.
var NotebookViewActions = []string{notebooks.ActionNotebooksRead}
var NotebookEditActions = append(NotebookViewActions, []string{
	notebooks.ActionNotebooksWrite,
	notebooks.ActionNotebooksDelete,
}...)
var NotebookAdminActions = NotebookEditActions
