package migration

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

const DASHBOARD_FOLDER = "%s Alerts - %s"

// MaxFolderName is the maximum length of the folder name generated using DASHBOARD_FOLDER format
const MaxFolderName = 255

var (
	migratorPermissions = []accesscontrol.Permission{
		{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
		{Action: dashboards.ActionFoldersPermissionsRead, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeDashboardsAll},
		{Action: dashboards.ActionFoldersCreate},
		{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
	}
	generalAlertingFolderTitle = "General Alerting"
)

// getMigrationUser returns a background user for the given orgID with permissions to execute migration-related tasks.
func getMigrationUser(orgID int64) identity.Requester {
	return accesscontrol.BackgroundUser("ngalert_migration", orgID, org.RoleAdmin, migratorPermissions)
}

// getAlertFolderNameFromDashboard generates a folder name for alerts that belong to a dashboard. Formats the string according to DASHBOARD_FOLDER format.
// If the resulting string exceeds the migrations.MaxTitleLength, the dashboard title is stripped to be at the maximum length
func getAlertFolderNameFromDashboard(dash *dashboards.Dashboard) string {
	maxLen := MaxFolderName - len(fmt.Sprintf(DASHBOARD_FOLDER, "", dash.UID))
	title := dash.Title
	if len(title) > maxLen {
		title = title[:maxLen]
	}
	return fmt.Sprintf(DASHBOARD_FOLDER, title, dash.UID) // include UID to the name to avoid collision
}

func (om *OrgMigration) getOrCreateMigratedFolder(ctx context.Context, log log.Logger, dashID int64) (*dashboards.Dashboard, *folder.Folder, error) {
	dash, err := om.migrationStore.GetDashboard(ctx, om.orgID, dashID)
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return nil, nil, fmt.Errorf("dashboard with ID %v under organisation %d not found: %w", dashID, om.orgID, err)
		}
		return nil, nil, fmt.Errorf("failed to get dashboard with ID %v under organisation %d: %w", dashID, om.orgID, err)
	}
	l := log.New(
		"dashboardTitle", dash.Title,
		"dashboardUID", dash.UID,
	)

	var migratedFolder *folder.Folder
	switch {
	case dash.HasACL:
		folderName := getAlertFolderNameFromDashboard(dash)
		f, ok := om.folderCache[folderName]
		if !ok {
			l.Info("create a new folder for alerts that belongs to dashboard because it has custom permissions", "folder", folderName)
			// create folder and assign the permissions of the dashboard (included default and inherited)
			f, err = om.createFolder(ctx, om.orgID, folderName)
			if err != nil {
				return nil, nil, fmt.Errorf("create new folder: %w", err)
			}
			permissions, err := om.migrationStore.GetACL(ctx, dash.OrgID, dash.ID)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to get dashboard %d under organisation %d permissions: %w", dash.ID, dash.OrgID, err)
			}
			err = om.migrationStore.SetACL(ctx, f.OrgID, f.ID, permissions)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to set folder %d under organisation %d permissions: %w", f.ID, f.OrgID, err)
			}
			om.folderCache[folderName] = f
		}
		migratedFolder = f
	case dash.FolderID > 0:
		// get folder if exists
		f, err := om.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{ID: &dash.FolderID, OrgID: dash.OrgID, SignedInUser: getMigrationUser(dash.OrgID)})
		if err != nil {
			// If folder does not exist then the dashboard is an orphan and we migrate the alert to the general folder.
			l.Warn("Failed to find folder for dashboard. Migrate rule to the default folder", "missing_folder_id", dash.FolderID, "error", err)
			migratedFolder, err = om.getOrCreateGeneralFolder(ctx, dash.OrgID)
			if err != nil {
				return nil, nil, err
			}
		} else {
			migratedFolder = f
		}
	default:
		migratedFolder, err = om.getOrCreateGeneralFolder(ctx, dash.OrgID)
		if err != nil {
			return nil, nil, err
		}
	}

	if migratedFolder.UID == "" {
		return nil, nil, fmt.Errorf("empty folder identifier")
	}

	return dash, migratedFolder, nil
}

// getOrCreateGeneralFolder returns the general folder under the specific organisation
// If the general folder does not exist it creates it.
func (om *OrgMigration) getOrCreateGeneralFolder(ctx context.Context, orgID int64) (*folder.Folder, error) {
	if om.generalAlertingFolder != nil {
		return om.generalAlertingFolder, nil
	}
	f, err := om.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &generalAlertingFolderTitle, SignedInUser: getMigrationUser(orgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			// create folder
			generalAlertingFolder, err := om.createFolder(ctx, orgID, generalAlertingFolderTitle)
			if err != nil {
				return nil, fmt.Errorf("create general alerting folder '%s': %w", generalAlertingFolderTitle, err)
			}
			om.generalAlertingFolder = generalAlertingFolder
			return om.generalAlertingFolder, nil
		}
		return nil, fmt.Errorf("get general alerting folder '%s': %w", generalAlertingFolderTitle, err)
	}
	om.generalAlertingFolder = f

	return om.generalAlertingFolder, nil
}

// createFolder creates a new folder with given permissions.
func (om *OrgMigration) createFolder(ctx context.Context, orgID int64, title string) (*folder.Folder, error) {
	f, err := om.migrationStore.CreateFolder(ctx, &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        title,
		SignedInUser: getMigrationUser(orgID).(*user.SignedInUser),
	})
	if err != nil {
		return nil, err
	}

	om.state.CreatedFolders = append(om.state.CreatedFolders, f.UID)

	return f, nil
}
