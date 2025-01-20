package permissions

import (
	"bytes"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
)

type accessControlDashboardRefactoredPermissionFilter struct {
	accessControlDashboardPermissionFilter

	dashboardActionsToCheck           []any
	folderActionsToCheckForDashboards []any
	folderActionsToCheckForFolders    []any
}

func (f *accessControlDashboardRefactoredPermissionFilter) getDashboardActionsToCheck() []any {
	if f.dashboardActionsToCheck == nil {
		dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
		folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)
		f.dashboardActionsToCheck = actionsToCheck(f.dashboardAction, f.dashboardActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)
	}
	return f.dashboardActionsToCheck
}

func (f *accessControlDashboardRefactoredPermissionFilter) getFolderActionsToCheckForDashboards() []any {
	if f.folderActionsToCheckForDashboards == nil {
		dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
		folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)
		f.folderActionsToCheckForDashboards = actionsToCheck(f.dashboardAction, f.folderActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)
	}
	return f.folderActionsToCheckForDashboards
}

func (f *accessControlDashboardRefactoredPermissionFilter) getFolderActionsToCheckForFolders() []any {
	if f.folderActionsToCheckForFolders == nil {
		folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)
		f.folderActionsToCheckForFolders = actionsToCheck(f.folderAction, f.folderActionSets, f.user.GetPermissions(), folderWildcards)
	}
	return f.folderActionsToCheckForFolders
}

// fallback returns true if the old permission filter should be used.
func (f *accessControlDashboardRefactoredPermissionFilter) fallback() bool {
	useSelfContainedPermissions := f.user.IsAuthenticatedBy(login.ExtendedJWTModule)
	// If nested folders are not enabled, recursive queries are not supported, or self-contained permissions are used,
	// fall back to the old permission filter.
	if !f.features.IsEnabledGlobally(featuremgmt.FlagNestedFolders) || !f.recursiveQueriesAreSupported || useSelfContainedPermissions {
		return true
	}

	// If the user is not authenticated or does not have the required actions, fall back to the old permission filter.
	if f.user == nil || f.user.IsNil() || !f.hasRequiredActions() {
		return true
	}

	return false
}

func (f *accessControlDashboardRefactoredPermissionFilter) With() (string, []any) {
	if f.fallback() {
		return f.accessControlDashboardPermissionFilter.With()
	}

	var userID int64
	if id, err := identity.UserIdentifier(f.user.GetID()); err == nil {
		userID = id
	}
	baseRoleQry, args := accesscontrol.UserRolesFilterInner(f.user.GetOrgID(), userID, f.user.GetTeams(), accesscontrol.GetOrgRoles(f.user))

	args = append(args, f.getDashboardActionsToCheck()...)
	args = append(args, f.getFolderActionsToCheckForDashboards()...)
	args = append(args, f.getFolderActionsToCheckForFolders()...)

	tmpl := `{{if or (gt (len .DashboardActionsToCheck) 0) (gt (len .FolderActionsToCheckForFolders)  0) (gt (len .FolderActionsToCheckForDashboards) 0) }}
WITH RECURSIVE base_roles AS (
    {{.BaseRoles}}
),
effective_permissions AS (
    SELECT DISTINCT 
        p.identifier,
        p.kind,
	{{if gt (len .DashboardActionsToCheck)  0}}
        -- Track if permission allows dashboard access
	MAX(CASE WHEN p.action IN ( {{.DashboardActionsToCheckPlaceholders}} ) THEN 1 ELSE 0 END) as has_dashboard_access,
	{{else}}
	0 as has_dashboard_access{{if or (gt (len .FolderActionsToCheckForFolders) 0) (gt (len .FolderActionsToCheckForDashboards) 0) }},{{end}}
	{{end}}
	{{if gt (len .FolderActionsToCheckForDashboards) 0}}
        -- Track if permission allows inherited dashboard access
	MAX(CASE WHEN p.action IN ( {{.FolderActionsToCheckForDashboardsPlaceholders}}) THEN 1 ELSE 0 END) as has_folder_access_for_dashboards,
	{{else}}
	0 as has_folder_access_for_dashboards,
	{{end}}
	{{if gt (len .FolderActionsToCheckForFolders) 0}}
        -- Track if permission allows folder access
	MAX(CASE WHEN p.action IN ( {{.FolderActionsToCheckForFoldersPlaceholders}} ) THEN 1 ELSE 0 END) as has_folder_access_for_folders
	{{else}}
	0 as has_folder_access_for_folders
	{{end}}
    FROM permission p
    JOIN base_roles br ON p.role_id = br.role_id
    WHERE p.attribute = 'uid'
    AND p.kind IN ('folders', 'dashboards')
    GROUP BY p.identifier, p.kind
),
folder_tree AS (
    -- Base case: folders user has direct permissions to
    SELECT 
        f.uid,
        f.parent_uid,
        f.org_id,
        1 as level,
        -- Inherit both types of permissions from direct folder permissions
        COALESCE(ep.has_folder_access_for_dashboards, 0) as inherited_folder_access_for_dashboards,
        COALESCE(ep.has_folder_access_for_folders, 0) as inherited_folder_access_for_folders
    FROM folder f
    LEFT JOIN effective_permissions ep ON f.uid = ep.identifier AND ep.kind = 'folders'
    WHERE f.org_id = ?
    AND (ep.identifier IS NOT NULL)  -- Has direct folder permissions
    
    UNION ALL
    
    -- Recursive case: child folders inherit permissions
    SELECT 
        f.uid,
        f.parent_uid,
        f.org_id,
        ft.level + 1,
        -- Inherit permissions from parent
        ft.inherited_folder_access_for_dashboards,
        ft.inherited_folder_access_for_folders
    FROM folder f
    JOIN folder_tree ft ON f.parent_uid = ft.uid AND f.org_id = ft.org_id
    WHERE f.org_id = ?
),
accessible_folders_for_folders AS (
    -- Folders accessible either through direct permissions or inheritance
    SELECT DISTINCT uid 
    FROM folder_tree 
    WHERE inherited_folder_access_for_folders = 1
),
accessible_folders_for_dashboards AS (
    -- Dashboard accessible through inheritance
    SELECT DISTINCT uid 
    FROM folder_tree 
    WHERE inherited_folder_access_for_dashboards = 1
),
accessible_dashboards AS (
    -- Dashboards accessible through direct dashboard permissions
    SELECT identifier FROM effective_permissions WHERE kind = 'dashboards' AND has_dashboard_access = 1
)
{{end}}`

	t := template.Must(template.New("recursiveQueries").Parse(tmpl))
	data := struct {
		BaseRoles                                     string
		DashboardActionsToCheck                       []any
		DashboardActionsToCheckPlaceholders           string
		FolderActionsToCheckForFolders                []any
		FolderActionsToCheckForFoldersPlaceholders    string
		FolderActionsToCheckForDashboards             []any
		FolderActionsToCheckForDashboardsPlaceholders string
	}{
		BaseRoles:                                     baseRoleQry,
		DashboardActionsToCheck:                       f.getDashboardActionsToCheck(),
		DashboardActionsToCheckPlaceholders:           "?" + strings.Repeat(", ?", max(0, len(f.getDashboardActionsToCheck())-1)),
		FolderActionsToCheckForFolders:                f.getFolderActionsToCheckForFolders(),
		FolderActionsToCheckForFoldersPlaceholders:    "?" + strings.Repeat(", ?", max(0, len(f.getFolderActionsToCheckForFolders())-1)),
		FolderActionsToCheckForDashboards:             f.getFolderActionsToCheckForDashboards(),
		FolderActionsToCheckForDashboardsPlaceholders: "?" + strings.Repeat(", ?", max(0, len(f.getFolderActionsToCheckForDashboards())-1)),
	}

	var result bytes.Buffer
	err := t.Execute(&result, data)
	if err != nil {
		// TODO fix me
		panic("failed to execute recursive queries template")
	}

	if result.String() == "" {
		return "", nil
	}
	return result.String(), append(args, f.user.GetOrgID(), f.user.GetOrgID())
}

func (f *accessControlDashboardRefactoredPermissionFilter) buildClauses() {
	if f.fallback() {
		f.accessControlDashboardPermissionFilter.buildClauses()
		return
	}

	tmpl := `(
	{{if .CheckForDashboards}}
		{{if gt (len .DashboardActionsToCheck) 0}}
	-- dashboards with direct permission
	(dashboard.uid IN (SELECT identifier FROM accessible_dashboards) AND NOT dashboard.is_folder)
	OR
	-- dashboards in accessible folder
	(dashboard.folder_uid IN (SELECT uid FROM accessible_folders_for_dashboards) AND NOT dashboard.is_folder)
			{{if .HasAccessToRoot}}
	-- dashboards under the root if the user has the required permissions on the root
	OR (dashboard.folder_uid = 0 AND NOT dashboard.is_folder)
			{{end}}
		{{else}}
	NOT dashboard.is_folder
		{{end}}
	{{end}}
	{{if .CheckForFolders}}
		{{if .CheckForDashboards}}
	OR
		{{end}}
		{{if gt (len .FolderActionsToCheckForFolders) 0}}
	-- folders accessible either through direct permissions or inheritance
	(dashboard.uid IN (SELECT uid FROM accessible_folders_for_folders) AND dashboard.is_folder)
		{{else}}
	dashboard.is_folder
		{{end}}
	{{end}}
	)`
	funcMap := template.FuncMap{
		"len": func(v []any) int {
			return len(v)
		},
	}
	t := template.Must(template.New("where").Funcs(funcMap).Parse(tmpl))

	data := struct {
		DashboardActionsToCheck []any
		//FolderActionsToCheckForDashboards []any
		FolderActionsToCheckForFolders []any
		CheckForDashboards             bool
		CheckForFolders                bool
		HasAccessToRoot                bool
	}{
		DashboardActionsToCheck: f.getDashboardActionsToCheck(),
		//FolderActionsToCheckForDashboards: f.getFolderActionsToCheckForDashboards(),
		FolderActionsToCheckForFolders: f.getFolderActionsToCheckForFolders(),
		CheckForDashboards:             f.dashboardAction != "",
		CheckForFolders:                f.folderAction != "",
		HasAccessToRoot:                hasAccessToRoot(f.dashboardAction, f.user),
	}

	var result bytes.Buffer
	err := t.Execute(&result, data)
	if err != nil {
		// TODO fix me
		panic("failed to execute where template")
	}

	f.where = clause{string: result.String()}
}
