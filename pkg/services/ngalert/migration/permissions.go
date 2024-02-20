package migration

import (
	"context"
	"crypto"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// DASHBOARD_FOLDER is the format used to generate the folder name for migrated dashboards with custom permissions.
const DASHBOARD_FOLDER = "%s Alerts - %s"

// MaxFolderName is the maximum length of the folder name generated using DASHBOARD_FOLDER format
const MaxFolderName = 255

var (
	// migratorPermissions are the permissions required for the background user to migrate alerts.
	migratorPermissions = []accesscontrol.Permission{
		{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
		{Action: dashboards.ActionFoldersPermissionsRead, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeDashboardsAll},
		{Action: dashboards.ActionFoldersCreate},
		{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
		{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
		{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
	}

	// generalAlertingFolderTitle is the title of the general alerting folder. This is used for dashboard alerts in the general folder.
	generalAlertingFolderTitle = "General Alerting"

	// permissionMap maps the "friendly" permission name for a ResourcePermissions actions to the dashboardaccess.PermissionType.
	// A sort of reverse accesscontrol Service.MapActions similar to api.dashboardPermissionMap.
	permissionMap = map[string]dashboardaccess.PermissionType{
		"View":  dashboardaccess.PERMISSION_VIEW,
		"Edit":  dashboardaccess.PERMISSION_EDIT,
		"Admin": dashboardaccess.PERMISSION_ADMIN,
	}
)

// getMigrationUser returns a background user for the given orgID with permissions to execute migration-related tasks.
func getMigrationUser(orgID int64) identity.Requester {
	return accesscontrol.BackgroundUser("ngalert_migration", orgID, org.RoleAdmin, migratorPermissions)
}

type migrationFolder struct {
	uid     string
	created bool
	warning string
}

func (sync *sync) migratedFolder(ctx context.Context, l log.Logger, dashboardUID string, folderID int64) (*migrationFolder, error) {
	dashFolder, err := sync.getFolder(ctx, folderID)
	if err != nil {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
		// nolint:staticcheck
		l.Warn("Failed to find folder for dashboard", "missingFolderId", folderID, "error", err)
	}
	if dashFolder != nil {
		l = l.New("folderUid", dashFolder.UID, "folderName", dashFolder.Title)
	}

	migratedFolder, err := sync.getOrCreateMigratedFolder(ctx, l, dashboardUID, dashFolder)
	if err != nil {
		return nil, err
	}

	du := migrationFolder{
		uid:     migratedFolder.UID,
		created: migratedFolder.CreatedBy == newFolder,
	}
	if dashFolder == nil && migratedFolder.Title == generalAlertingFolderTitle {
		du.warning = "dashboard alerts moved to general alerting folder during upgrade: original folder not found"
	} else if folderID <= 0 && strings.HasPrefix(migratedFolder.Title, generalAlertingFolderTitle) {
		du.warning = "dashboard alerts moved to general alerting folder during upgrade: general folder not supported"
	} else if migratedFolder.ID != folderID { // nolint:staticcheck
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
		du.warning = "dashboard alerts moved to new folder during upgrade: folder permission changes were needed"
	}

	return &du, nil
}

// getOrCreateMigratedFolder returns the folder that alerts in a given dashboard should migrate to.
// If the dashboard has no custom permissions, this should be the same folder as dash.FolderID.
// If the dashboard has custom permissions that affect access, this should be a new folder with migrated permissions relating to both the dashboard and parent folder.
// Any dashboard that has greater read/write permissions for an orgRole/team/user compared to its folder will necessitate creating a new folder with the same permissions as the dashboard.
func (sync *sync) getOrCreateMigratedFolder(ctx context.Context, l log.Logger, dashboardUID string, parentFolder *folder.Folder) (*folder.Folder, error) {
	// If parentFolder does not exist then the dashboard is an orphan. We migrate the alert to the general alerting folder.
	// The general alerting folder is only accessible to admins.
	if parentFolder == nil {
		l.Info("Migrating alert to the general alerting folder")
		f, err := sync.getOrCreateGeneralAlertingFolder(ctx, sync.orgID)
		if err != nil {
			return nil, fmt.Errorf("general alerting folder: %w", err)
		}
		return f, nil
	}

	// Check if the dashboard has custom permissions. If it does, we need to create a new folder for it.
	// This folder will be cached for re-use for each dashboard in the folder with the same permissions.
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
	// nolint:staticcheck
	permissionsToFolder, ok := sync.permissionsMap[parentFolder.ID]
	if !ok {
		permissionsToFolder = make(map[permissionHash]*folder.Folder)
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.NGAlerts).Inc()
		// nolint:staticcheck
		sync.permissionsMap[parentFolder.ID] = permissionsToFolder

		folderPerms, err := sync.getFolderPermissions(ctx, parentFolder)
		if err != nil {
			return nil, fmt.Errorf("folder permissions: %w", err)
		}
		newFolderPerms, _ := sync.convertResourcePerms(folderPerms)

		// We assign the folder to the cache so that any dashboards with identical equivalent permissions will use the parent folder instead of creating a new one.
		folderPermsHash, err := createHash(newFolderPerms)
		if err != nil {
			return nil, fmt.Errorf("hash of folder permissions: %w", err)
		}
		permissionsToFolder[folderPermsHash] = parentFolder
	}

	// Now we compute the hash of the dashboard permissions and check if we have a folder for it. If not, we create a new one.
	perms, err := sync.getDashboardPermissions(ctx, dashboardUID)
	if err != nil {
		return nil, fmt.Errorf("dashboard permissions: %w", err)
	}
	newPerms, unusedPerms := sync.convertResourcePerms(perms)
	hash, err := createHash(newPerms)
	if err != nil {
		return nil, fmt.Errorf("hash of dashboard permissions: %w", err)
	}

	customFolder, ok := permissionsToFolder[hash]
	if !ok {
		folderName := generateAlertFolderName(parentFolder, hash)
		l.Info("Dashboard has custom permissions, create a new folder for alerts.", "newFolder", folderName)
		f, err := sync.createFolder(ctx, sync.orgID, folderName, newPerms)
		if err != nil {
			return nil, err
		}

		// If the role is not managed or basic we don't attempt to migrate its permissions. This is because
		// the logic to migrate would be complex, error-prone, and even if done correctly would have significant
		// drawbacks in the case of custom provisioned roles. Instead, we log if the role has dashboard permissions that could
		// potentially override the folder permissions. These overrides would always be to increase permissions not decrease them,
		// so the risk of giving users access to alerts they shouldn't have access to is mitigated.
		overrides := potentialOverrides(unusedPerms, newPerms)
		if len(overrides) > 0 {
			l.Warn("Some roles were not migrated but had the potential to allow additional access. Please verify the permissions of the new folder.", "roles", overrides, "newFolder", folderName)
		}

		permissionsToFolder[hash] = f
		return f, nil
	}

	return customFolder, nil
}

// generateAlertFolderName generates a folder name for alerts that belong to a dashboard with custom permissions.
// Formats the string according to DASHBOARD_FOLDER format.
// If the resulting string's length exceeds migration.MaxFolderName, the dashboard title is stripped to be at the maximum length.
func generateAlertFolderName(f *folder.Folder, hash permissionHash) string {
	maxLen := MaxFolderName - len(fmt.Sprintf(DASHBOARD_FOLDER, "", hash))
	title := f.Title
	if len(title) > maxLen {
		title = title[:maxLen]
	}
	return fmt.Sprintf(DASHBOARD_FOLDER, title, hash) // Include hash in the name to avoid collision.
}

// isBasic returns true if the given roleName is a basic role.
func isBasic(roleName string) bool {
	return strings.HasPrefix(roleName, accesscontrol.BasicRolePrefix)
}

// convertResourcePerms converts the given resource permissions (from a dashboard or folder) to a set of unique, sorted SetResourcePermissionCommands.
// This is done by iterating over the managed, basic, and inherited resource permissions and adding the highest permission for each orgrole/user/team.
//
// # Details
//
// There are two role types that we consider:
//   - managed (ex. managed:users:1:permissions, managed:builtins:editor:permissions, managed:teams:1:permissions):
//     These are the only roles that exist in OSS. For each of these roles, we add the actions of the highest
//     dashboardaccess.PermissionType between the folder and the dashboard. Permissions from the folder are inherited.
//     The added actions should have scope=folder:uid:xxxxxx, where xxxxxx is the new folder uid.
//   - basic (ex. basic:admin, basic:editor):
//     These are roles used in enterprise. Every user should have one of these roles. They should be considered
//     equivalent to managed:builtins. The highest dashboardaccess.PermissionType between the two should be used.
//
// There are two role types that we do not consider:
//   - fixed: (ex. fixed:dashboards:reader, fixed:dashboards:writer):
//     These are roles with fixed actions/scopes. They should not be given any extra actions/scopes because they
//     can be overwritten. Because of this, to ensure that all users with this role have the correct access to the
//     new folder we would need to find all users with this role and add a permission for
//     action folders:read/write -> folder:uid:xxxxxx to their managed:users:X:permissions.
//     This will eventually fall out of sync.
//   - custom: Custom roles created via API or provisioning.
//     Similar to fixed roles, we can't give them any extra actions/scopes because they can be overwritten.
//
// For now, we choose the simpler approach of handling managed and basic roles. Fixed and custom roles will not
// be taken into account, but we will log a warning if they had the potential to override the folder permissions.
func (sync *sync) convertResourcePerms(rperms []accesscontrol.ResourcePermission) ([]accesscontrol.SetResourcePermissionCommand, []accesscontrol.ResourcePermission) {
	keep := make(map[accesscontrol.SetResourcePermissionCommand]dashboardaccess.PermissionType)
	unusedPerms := make([]accesscontrol.ResourcePermission, 0)
	for _, p := range rperms {
		if p.IsManaged || p.IsInherited || isBasic(p.RoleName) {
			if permission := sync.migrationStore.MapActions(p); permission != "" {
				sp := accesscontrol.SetResourcePermissionCommand{
					UserID:      p.UserId,
					TeamID:      p.TeamId,
					BuiltinRole: p.BuiltInRole,
				}
				// We could have redundant perms, ex: if one is inherited from the parent folder, or we have basic roles from enterprise.
				// We use the highest permission available.
				pType := permissionMap[permission]
				current, ok := keep[sp]
				if !ok || pType > current {
					keep[sp] = pType
				}
			}
		} else {
			// Keep track of unused perms, so we can later log a warning if they had the potential to override the folder permissions.
			unusedPerms = append(unusedPerms, p)
		}
	}

	permissions := make([]accesscontrol.SetResourcePermissionCommand, 0, len(keep))
	for p, pType := range keep {
		p.Permission = pType.String()
		permissions = append(permissions, p)
	}

	// Stable sort since we will be creating a hash of this to compare dashboard perms to folder perms.
	sort.SliceStable(permissions, func(i, j int) bool {
		if permissions[i].BuiltinRole != permissions[j].BuiltinRole {
			return permissions[i].BuiltinRole < permissions[j].BuiltinRole
		}
		if permissions[i].UserID != permissions[j].UserID {
			return permissions[i].UserID < permissions[j].UserID
		}
		if permissions[i].TeamID != permissions[j].TeamID {
			return permissions[i].TeamID < permissions[j].TeamID
		}
		return permissions[i].Permission < permissions[j].Permission
	})

	return permissions, unusedPerms
}

// potentialOverrides returns a map of roles from unusedOldPerms that have dashboard permissions that could potentially
// override the given folder permissions in newPerms. These overrides are always to increase permissions not decrease them.
func potentialOverrides(unusedOldPerms []accesscontrol.ResourcePermission, newPerms []accesscontrol.SetResourcePermissionCommand) map[string]dashboardaccess.PermissionType {
	var lowestPermission dashboardaccess.PermissionType
	for _, p := range newPerms {
		if p.BuiltinRole == string(org.RoleEditor) || p.BuiltinRole == string(org.RoleViewer) {
			pType := permissionMap[p.Permission]
			if pType < lowestPermission {
				lowestPermission = pType
			}
		}
	}

	nonManagedPermissionTypes := make(map[string]dashboardaccess.PermissionType)
	for _, p := range unusedOldPerms {
		existing, ok := nonManagedPermissionTypes[p.RoleName]
		if ok && existing == dashboardaccess.PERMISSION_EDIT {
			// We've already handled the highest permission we care about, no need to check this role anymore.
			continue
		}

		if p.Contains([]string{dashboards.ActionDashboardsWrite}) {
			existing = dashboardaccess.PERMISSION_EDIT
		} else if p.Contains([]string{dashboards.ActionDashboardsRead}) {
			existing = dashboardaccess.PERMISSION_VIEW
		}

		if existing > lowestPermission && existing > nonManagedPermissionTypes[p.RoleName] {
			nonManagedPermissionTypes[p.RoleName] = existing
		}
	}

	return nonManagedPermissionTypes
}

type permissionHash string

// createHash returns a hash of the given permissions.
func createHash(setResourcePermissionCommands []accesscontrol.SetResourcePermissionCommand) (permissionHash, error) {
	// Speed is not particularly important here.
	digester := crypto.MD5.New()
	var separator = []byte{255}
	for _, perm := range setResourcePermissionCommands {
		_, err := fmt.Fprint(digester, separator)
		if err != nil {
			return "", err
		}
		_, err = fmt.Fprint(digester, perm)
		if err != nil {
			return "", err
		}
	}
	return permissionHash(hex.EncodeToString(digester.Sum(nil))), nil
}

// getFolderPermissions Get permissions for folder.
func (sync *sync) getFolderPermissions(ctx context.Context, f *folder.Folder) ([]accesscontrol.ResourcePermission, error) {
	if p, ok := sync.folderPermissionCache[f.UID]; ok {
		return p, nil
	}
	p, err := sync.migrationStore.GetFolderPermissions(ctx, getMigrationUser(f.OrgID), f.UID)
	if err != nil {
		return nil, err
	}
	sync.folderPermissionCache[f.UID] = p
	return p, nil
}

// getDashboardPermissions Get permissions for dashboard.
func (sync *sync) getDashboardPermissions(ctx context.Context, uid string) ([]accesscontrol.ResourcePermission, error) {
	p, err := sync.migrationStore.GetDashboardPermissions(ctx, getMigrationUser(sync.orgID), uid)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// getFolder returns the parent folder for the given dashboard. If the dashboard is in the general folder, it returns the general alerting folder.
func (sync *sync) getFolder(ctx context.Context, folderId int64) (*folder.Folder, error) {
	if f, ok := sync.folderCache[folderId]; ok {
		return f, nil
	}

	if folderId <= 0 {
		// Don't use general folder since it has no uid, instead we use a new "General Alerting" folder.
		migratedFolder, err := sync.getOrCreateGeneralAlertingFolder(ctx, sync.orgID)
		if err != nil {
			return nil, fmt.Errorf("get or create general folder: %w", err)
		}
		return migratedFolder, nil
	}

	f, err := sync.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{ID: &folderId, OrgID: sync.orgID, SignedInUser: getMigrationUser(sync.orgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return nil, fmt.Errorf("folder with id %v not found", folderId)
		}
		return nil, fmt.Errorf("get folder %d: %w", folderId, err)
	}
	sync.folderCache[folderId] = f
	return f, nil
}

// getOrCreateGeneralAlertingFolder returns the general alerting folder under the specific organisation
// If the general alerting folder does not exist it creates it.
func (sync *sync) getOrCreateGeneralAlertingFolder(ctx context.Context, orgID int64) (*folder.Folder, error) {
	if sync.generalAlertingFolder != nil {
		return sync.generalAlertingFolder, nil
	}
	f, err := sync.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &generalAlertingFolderTitle, SignedInUser: getMigrationUser(orgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			// create general alerting folder without permissions to mimic the general folder.
			f, err := sync.createFolder(ctx, orgID, generalAlertingFolderTitle, nil)
			if err != nil {
				return nil, fmt.Errorf("create general alerting folder: %w", err)
			}
			sync.generalAlertingFolder = f
			return f, err
		}
		return nil, fmt.Errorf("get folder '%s': %w", generalAlertingFolderTitle, err)
	}
	sync.generalAlertingFolder = f
	return f, nil
}

// newFolder is used to as the value of createdBy when the folder has been created by this migration. It is not persisted
// to the database. -8 is chosen as it's the same value that was used in the original version of migration.
const newFolder = -8

// createFolder creates a new folder with given permissions.
func (sync *sync) createFolder(ctx context.Context, orgID int64, title string, newPerms []accesscontrol.SetResourcePermissionCommand) (*folder.Folder, error) {
	f, err := sync.migrationStore.CreateFolder(ctx, &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        title,
		SignedInUser: getMigrationUser(orgID).(*user.SignedInUser),
	})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderSameNameExists) {
			// If the folder already exists, we return the existing folder.
			// This isn't perfect since permissions might have been manually modified,
			// but the only folders we should be creating here are ones with permission
			// hash suffix or general alerting. Neither of which is likely to spuriously
			// conflict with an existing folder.
			sync.log.FromContext(ctx).Warn("Folder already exists, using existing folder", "title", title)
			f, err := sync.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &title, SignedInUser: getMigrationUser(orgID)})
			if err != nil {
				return nil, err
			}
			return f, nil
		}
		return nil, err
	}

	if len(newPerms) > 0 {
		_, err = sync.migrationStore.SetFolderPermissions(ctx, orgID, f.UID, newPerms...)
		if err != nil {
			return nil, fmt.Errorf("set permissions: %w", err)
		}
	}

	f.CreatedBy = newFolder // We don't persist this, it's just to let callers know this is a newly created folder.

	return f, nil
}
