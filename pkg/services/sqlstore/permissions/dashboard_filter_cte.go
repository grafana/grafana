package permissions

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// accessControlDashboardPermissionFilterCTE is a faster variant that builds a single
// allowed set using CTEs and filters dashboards/folders by membership.
// This avoids multiple large OR branches and deep nested sub-queries.
type accessControlDashboardPermissionFilterCTE struct {
	accessControlDashboardPermissionFilter

	withClause clause
	leftJoin   string
}

func (f *accessControlDashboardPermissionFilterCTE) LeftJoin() string { return f.leftJoin }

func (f *accessControlDashboardPermissionFilterCTE) With() (string, []any) {
	return f.withClause.string, f.withClause.params
}

func (f *accessControlDashboardPermissionFilterCTE) Where() (string, []any) {
	return f.where.string, f.where.params
}

// buildClauses constructs CTEs:
//   - direct_dash(uid): direct dashboard permissions
//   - seed_folders(uid): seed folders from permissions
//   - allowed_folders(uid, parent_uid, org_id): recursive folders from seeds
//   - dash_from_folders(uid): dashboards under allowed folders (+root if applicable)
//   - allowed_dashboards(uid): union of direct + from folders
//
// and uses a simple membership predicate instead of large OR conditions.
func (f *accessControlDashboardPermissionFilterCTE) buildClauses(dialect migrator.Dialect) {
	if f.user == nil || f.user.IsNil() || !f.hasRequiredActions() {
		f.where = clause{string: "(1 = 0)"}
		return
	}

	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	var userID int64
	if id, err := identity.UserIdentifier(f.user.GetID()); err == nil {
		userID = id
	}

	orgID := f.user.GetOrgID()
	filter, params := accesscontrol.UserRolesFilter(orgID, userID, f.user.GetTeams(), accesscontrol.GetOrgRoles(f.user), dialect)
	rolesFilter := " AND role_id IN(SELECT id FROM role " + filter + ") "

	useSelfContainedPermissions := f.user.IsAuthenticatedBy(login.ExtendedJWTModule)

	var withBuilder strings.Builder
	var withParams []any
	cteCount := 0
	addCte := func(name, sql string, args ...any) {
		if cteCount == 0 {
			withBuilder.WriteString("WITH RECURSIVE ")
			withBuilder.WriteString(name)
			withBuilder.WriteString(" AS (")
			withBuilder.WriteString(sql)
			withBuilder.WriteString(")")
		} else {
			withBuilder.WriteString(", ")
			withBuilder.WriteString(name)
			withBuilder.WriteString(" AS (")
			withBuilder.WriteString(sql)
			withBuilder.WriteString(")")
		}
		withParams = append(withParams, args...)
		cteCount++
	}

	// Compute allowed dashboards set pieces
	var allDashboards bool
	var allFolders bool

	// Dashboards permission path
	var toCheckDashboards []any
	var toCheckFoldersForDash []any
	if f.dashboardAction != "" {
		toCheckDashboards = actionsToCheck(f.dashboardAction, f.dashboardActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)
		toCheckFoldersForDash = actionsToCheck(f.dashboardAction, f.folderActionSets, f.user.GetPermissions(), dashWildcards, folderWildcards)
		if len(toCheckDashboards) == 0 {
			// wildcard present for dashboards; allow all dashboards
			allDashboards = true
		}
	}

	// Folders permission path (for returning folders or for deriving dashboards from folders)
	var toCheckFolders []any
	if f.folderAction != "" {
		toCheckFolders = actionsToCheck(f.folderAction, f.folderActionSets, f.user.GetPermissions(), folderWildcards)
		if len(toCheckFolders) == 0 {
			// wildcard present for folders; allow all folders
			allFolders = true
		}
	}

	// Build CTEs only if needed; keep separate seeds for dashboards vs. folders
	seedFoldersDashName := "seed_folders_dash"
	allowedFoldersDashName := "allowed_folders_dash"
	seedFoldersFolderName := "seed_folders_folder"
	allowedFoldersFolderName := "allowed_folders_folder"
	directDashName := "direct_dash"
	// dash_from_folders removed in join strategy
	allowedDashboardsName := "allowed_dashboards"

	// Direct dashboards
	if f.dashboardAction != "" && !allDashboards {
		if !useSelfContainedPermissions {
			// SELECT identifier AS uid FROM permission WHERE kind='dashboards' AND attribute='uid' rolesFilter AND action IN (...)
			var sb strings.Builder
			sb.WriteString("SELECT identifier AS uid FROM permission WHERE kind = 'dashboards' AND attribute = 'uid'")
			sb.WriteString(rolesFilter)
			withParams = append(withParams, params...)
			if len(toCheckDashboards) == 1 {
				sb.WriteString(" AND action = ?")
				withParams = append(withParams, toCheckDashboards[0])
			} else {
				sb.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheckDashboards)-1) + ")")
				withParams = append(withParams, toCheckDashboards...)
			}
			addCte(directDashName, sb.String())
		} else {
			// Self-contained: build a tiny inline set from allowed UIDs
			dashArgs := getAllowedUIDs(f.dashboardAction, f.user, dashboards.ScopeDashboardsPrefix)
			if len(dashArgs) > 0 {
				// SELECT ? AS uid UNION ALL SELECT ? ...
				var sb strings.Builder
				for i := range dashArgs {
					if i == 0 {
						sb.WriteString("SELECT ? AS uid")
					} else {
						sb.WriteString(" UNION ALL SELECT ?")
					}
				}
				addCte(directDashName, sb.String(), dashArgs...)
			} else {
				// No allowed dashboards in JWT
				addCte(directDashName, "SELECT '' AS uid WHERE 1 = 0")
			}
		}
	}

	// Seed folders for deriving dashboards
	needFolderSeedsForDash := f.dashboardAction != "" && !allDashboards && (len(toCheckFoldersForDash) > 0 || useSelfContainedPermissions)
	if needFolderSeedsForDash {
		if !useSelfContainedPermissions {
			var sb strings.Builder
			sb.WriteString("SELECT identifier AS uid FROM permission WHERE kind = 'folders' AND attribute = 'uid'")
			sb.WriteString(rolesFilter)
			withParams = append(withParams, params...)
			if len(toCheckFoldersForDash) == 1 {
				sb.WriteString(" AND action = ?")
				withParams = append(withParams, toCheckFoldersForDash[0])
			} else {
				sb.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheckFoldersForDash)-1) + ")")
				withParams = append(withParams, toCheckFoldersForDash...)
			}
			addCte(seedFoldersDashName, sb.String())
		} else {
			folderArgs := getAllowedUIDs(f.dashboardAction, f.user, dashboards.ScopeFoldersPrefix)
			if len(folderArgs) > 0 {
				var sb strings.Builder
				for i := range folderArgs {
					if i == 0 {
						sb.WriteString("SELECT ? AS uid")
					} else {
						sb.WriteString(" UNION ALL SELECT ?")
					}
				}
				addCte(seedFoldersDashName, sb.String(), folderArgs...)
			} else {
				addCte(seedFoldersDashName, "SELECT '' AS uid WHERE 1 = 0")
			}
		}
		addCte(allowedFoldersDashName,
			fmt.Sprintf(
				"SELECT uid, parent_uid, org_id FROM folder WHERE org_id = ? AND uid IN (SELECT uid FROM %s) "+
					"UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN %s r ON f.parent_uid = r.uid AND f.org_id = r.org_id",
				seedFoldersDashName, allowedFoldersDashName,
			), orgID)
	}

	// Seed folders for returning folders
	needFolderSeedsForFolder := f.folderAction != "" && !allFolders && (len(toCheckFolders) > 0 || useSelfContainedPermissions)
	if needFolderSeedsForFolder {
		if !useSelfContainedPermissions {
			var sb strings.Builder
			sb.WriteString("SELECT identifier AS uid FROM permission WHERE kind = 'folders' AND attribute = 'uid'")
			sb.WriteString(rolesFilter)
			withParams = append(withParams, params...)
			if len(toCheckFolders) == 1 {
				sb.WriteString(" AND action = ?")
				withParams = append(withParams, toCheckFolders[0])
			} else {
				sb.WriteString(" AND action IN (?" + strings.Repeat(", ?", len(toCheckFolders)-1) + ")")
				withParams = append(withParams, toCheckFolders...)
			}
			addCte(seedFoldersFolderName, sb.String())
		} else {
			folderArgs := getAllowedUIDs(f.folderAction, f.user, dashboards.ScopeFoldersPrefix)
			if len(folderArgs) > 0 {
				var sb strings.Builder
				for i := range folderArgs {
					if i == 0 {
						sb.WriteString("SELECT ? AS uid")
					} else {
						sb.WriteString(" UNION ALL SELECT ?")
					}
				}
				addCte(seedFoldersFolderName, sb.String(), folderArgs...)
			} else {
				addCte(seedFoldersFolderName, "SELECT '' AS uid WHERE 1 = 0")
			}
		}
		addCte(allowedFoldersFolderName,
			fmt.Sprintf(
				"SELECT uid, parent_uid, org_id FROM folder WHERE org_id = ? AND uid IN (SELECT uid FROM %s) "+
					"UNION ALL SELECT f.uid, f.parent_uid, f.org_id FROM folder f INNER JOIN %s r ON f.parent_uid = r.uid AND f.org_id = r.org_id",
				seedFoldersFolderName, allowedFoldersFolderName,
			), orgID)
	}

	// Build dashboards from allowed folders + final allowed sets and a single join filter
	// We'll always produce allowed_dashboards and allowed_folders CTEs, handling wildcards by selecting the whole category.
	// 1) allowed dashboards
	{
		var sb strings.Builder
		var unionParts []string
		if allDashboards {
			// all dashboards are allowed
			unionParts = append(unionParts, "SELECT d.uid FROM dashboard d WHERE d.org_id = ? AND NOT d.is_folder")
			withParams = append(withParams, orgID)
		} else {
			// direct
			if strings.Contains(withBuilder.String(), " "+directDashName+" AS (") {
				unionParts = append(unionParts, "SELECT uid FROM "+directDashName)
			}
			// from folders
			if needFolderSeedsForDash {
				sb.Reset()
				sb.WriteString("SELECT d.uid FROM dashboard d WHERE d.org_id = ? AND NOT d.is_folder AND ")
				withParams = append(withParams, orgID)
				sb.WriteString("d.folder_id IN (SELECT df.id FROM dashboard df WHERE df.org_id = ? AND df.uid IN (SELECT uid FROM ")
				sb.WriteString(allowedFoldersDashName)
				sb.WriteString("))")
				withParams = append(withParams, orgID)
				unionParts = append(unionParts, sb.String())
			}
			// root (General)
			if hasAccessToRoot(f.dashboardAction, f.user) {
				unionParts = append(unionParts, "SELECT d.uid FROM dashboard d WHERE d.org_id = ? AND d.folder_id = 0 AND NOT d.is_folder")
				withParams = append(withParams, orgID)
			}
			if len(unionParts) == 0 {
				unionParts = append(unionParts, "SELECT '' WHERE 1 = 0")
			}
		}
		addCte(allowedDashboardsName, strings.Join(unionParts, " UNION "))
	}

	// 2) allowed folders
	{
		var unionParts []string
		if allFolders {
			unionParts = append(unionParts, "SELECT d.uid FROM dashboard d WHERE d.org_id = ? AND d.is_folder")
			withParams = append(withParams, orgID)
		} else if needFolderSeedsForFolder {
			unionParts = append(unionParts, "SELECT uid FROM "+allowedFoldersFolderName)
		} else {
			unionParts = append(unionParts, "SELECT '' WHERE 1 = 0")
		}
		addCte("allowed_folders_final", strings.Join(unionParts, " UNION "))
	}

	// 3) allowed_all: map into a single set with an is_folder flag (0 for dashboards, 1 for folders)
	addCte("allowed_all",
		"SELECT uid, 0 AS is_folder FROM "+allowedDashboardsName+" UNION SELECT uid, 1 AS is_folder FROM allowed_folders_final")

	// 4) Use a single left join and predicate to avoid large OR conditions entirely
	f.leftJoin = "allowed_all a ON a.uid = dashboard.uid AND a.is_folder = CASE WHEN dashboard.is_folder THEN 1 ELSE 0 END"
	f.withClause = clause{string: withBuilder.String(), params: withParams}
	f.where = clause{string: "(a.uid IS NOT NULL)", params: nil}
}

// Not used by this implementation but required by the interface.
func (f *accessControlDashboardPermissionFilterCTE) nestedFoldersSelectors(_ string, _ []any, _ string, _ string, _ string, _ int64) (string, []any) {
	return "", nil
}

// NewAccessControlDashboardPermissionFilterCTE creates a new fast CTE-based filter.
// Mirrors action selection from NewAccessControlDashboardPermissionFilter.
func NewAccessControlDashboardPermissionFilterCTE(user identity.Requester, permissionLevel dashboardaccess.PermissionType, queryType string, features featuremgmt.FeatureToggles, recursiveQueriesAreSupported bool, dialect migrator.Dialect) PermissionsFilter {
	if !recursiveQueriesAreSupported {
		// Fallback to the existing implementation when recursive CTEs are not supported by the DB
		return NewAccessControlDashboardPermissionFilter(user, permissionLevel, queryType, features, recursiveQueriesAreSupported, dialect)
	}
	needEdit := permissionLevel > dashboardaccess.PERMISSION_VIEW

	var folderAction string
	var dashboardAction string
	var folderActionSets []string
	var dashboardActionSets []string
	switch queryType {
	case searchstore.TypeFolder:
		folderAction = dashboards.ActionFoldersRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
			folderActionSets = []string{"folders:edit", "folders:admin"}
		}
	case searchstore.TypeDashboard:
		dashboardAction = dashboards.ActionDashboardsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
		if needEdit {
			dashboardAction = dashboards.ActionDashboardsWrite
			folderActionSets = []string{"folders:edit", "folders:admin"}
			dashboardActionSets = []string{"dashboards:edit", "dashboards:admin"}
		}
	case searchstore.TypeAlertFolder:
		folderAction = accesscontrol.ActionAlertingRuleRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		if needEdit {
			folderAction = accesscontrol.ActionAlertingRuleCreate
			folderActionSets = []string{"folders:edit", "folders:admin"}
		}
	case searchstore.TypeAnnotation:
		dashboardAction = accesscontrol.ActionAnnotationsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
	default:
		folderAction = dashboards.ActionFoldersRead
		dashboardAction = dashboards.ActionDashboardsRead
		folderActionSets = []string{"folders:view", "folders:edit", "folders:admin"}
		dashboardActionSets = []string{"dashboards:view", "dashboards:edit", "dashboards:admin"}
		if needEdit {
			folderAction = dashboards.ActionDashboardsCreate
			dashboardAction = dashboards.ActionDashboardsWrite
			folderActionSets = []string{"folders:edit", "folders:admin"}
			dashboardActionSets = []string{"dashboards:edit", "dashboards:admin"}
		}
	}

	f := &accessControlDashboardPermissionFilterCTE{
		accessControlDashboardPermissionFilter: accessControlDashboardPermissionFilter{
			user: user, folderAction: folderAction, folderActionSets: folderActionSets, dashboardAction: dashboardAction, dashboardActionSets: dashboardActionSets,
			features: features, recursiveQueriesAreSupported: recursiveQueriesAreSupported,
		},
	}
	f.buildClauses(dialect)
	return f
}
