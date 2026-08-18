package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/notebooks"
)

// Notebook action sets mirror the dashboard ones (view/edit), minus annotations which notebooks
// don't have. notebooks:create is folder-scoped, so it lives in FolderEditActions (see folder.go)
// rather than here, matching how dashboards:create is handled. There is no notebook-specific admin
// action yet (no permissions management), so Admin equals Edit.
var NotebookViewActions = []string{notebooks.ActionNotebooksRead}
var NotebookEditActions = append(NotebookViewActions, []string{
	notebooks.ActionNotebooksWrite,
	notebooks.ActionNotebooksDelete,
}...)
var NotebookAdminActions = NotebookEditActions
