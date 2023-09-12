package migration

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

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

func getBackgroundUser(orgID int64) *user.SignedInUser {
	backgroundUser := accesscontrol.BackgroundUser("ngalert_migration", orgID, org.RoleAdmin, migratorPermissions).(*user.SignedInUser)
	backgroundUser.UserID = migrationStore.FOLDER_CREATED_BY
	return backgroundUser
}

// getOrCreateGeneralFolder returns the general folder under the specific organisation
// If the general folder does not exist it creates it.
func (m *migration) getOrCreateGeneralFolder(ctx context.Context, orgID int64) (*folder.Folder, error) {
	f, err := m.migrationStore.GetFolder(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &generalAlertingFolderTitle, SignedInUser: getBackgroundUser(orgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			// create folder
			return m.migrationStore.CreateFolder(ctx, &folder.CreateFolderCommand{OrgID: orgID, Title: generalAlertingFolderTitle, SignedInUser: getBackgroundUser(orgID)})
		}
		return nil, fmt.Errorf("failed to get folder '%s': %w", generalAlertingFolderTitle, err)
	}

	return f, nil
}
