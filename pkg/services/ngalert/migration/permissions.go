package migration

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
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

type roleType string

const (
	RoleNone   roleType = "None"
	RoleViewer roleType = "Viewer"
	RoleEditor roleType = "Editor"
	RoleAdmin  roleType = "Admin"
)

func (r roleType) IsValid() bool {
	return r == RoleViewer || r == RoleAdmin || r == RoleEditor || r == RoleNone
}

type permissionType int

type dashboardACL struct {
	// nolint:stylecheck
	Id          int64
	OrgID       int64 `xorm:"org_id"`
	DashboardID int64 `xorm:"dashboard_id"`

	UserID     int64     `xorm:"user_id"`
	TeamID     int64     `xorm:"team_id"`
	Role       *roleType // pointer to be nullable
	Permission permissionType

	Created time.Time
	Updated time.Time
}

func (p dashboardACL) TableName() string { return "dashboard_acl" }

type folderHelper struct {
	store         db.DB
	dialect       migrator.Dialect
	folderService folder.Service
}

func getBackgroundUser(orgID int64) *user.SignedInUser {
	backgroundUser := accesscontrol.BackgroundUser("ngalert_migration", orgID, org.RoleAdmin, migratorPermissions).(*user.SignedInUser)
	backgroundUser.UserID = FOLDER_CREATED_BY
	return backgroundUser
}

// getOrCreateGeneralFolder returns the general folder under the specific organisation
// If the general folder does not exist it creates it.
func (m *folderHelper) getOrCreateGeneralFolder(ctx context.Context, orgID int64) (*folder.Folder, error) {
	f, err := m.folderService.Get(ctx, &folder.GetFolderQuery{OrgID: orgID, Title: &generalAlertingFolderTitle, SignedInUser: getBackgroundUser(orgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			// create folder
			return m.createFolder(ctx, orgID, generalAlertingFolderTitle)
		}
		return nil, fmt.Errorf("failed to get folder '%s': %w", generalAlertingFolderTitle, err)
	}

	return f, nil
}

// returns the folder of the given dashboard (if exists)
func (m *folderHelper) getFolder(ctx context.Context, dash *dashboards.Dashboard) (*folder.Folder, error) {
	f, err := m.folderService.Get(ctx, &folder.GetFolderQuery{ID: &dash.FolderID, OrgID: dash.OrgID, SignedInUser: getBackgroundUser(dash.OrgID)})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return nil, fmt.Errorf("folder with id %v not found", dash.FolderID)
		}
		return nil, fmt.Errorf("failed to get folder %d: %w", dash.FolderID, err)
	}

	return f, nil
}

// based on sqlstore.saveDashboard()
// it should be called from inside a transaction
func (m *folderHelper) createFolder(ctx context.Context, orgID int64, title string) (*folder.Folder, error) {
	return m.folderService.Create(ctx, &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        title,
		SignedInUser: getBackgroundUser(orgID),
	})
}

// based on SQLStore.UpdateDashboardACL()
// it should be called from inside a transaction
func (m *folderHelper) setACL(ctx context.Context, orgID int64, dashboardID int64, items []*dashboardACL) error {
	if dashboardID <= 0 {
		return fmt.Errorf("folder id must be greater than zero for a folder permission")
	}
	return m.store.WithDbSession(ctx, func(sess *db.Session) error {
		// userPermissionsMap is a map keeping the highest permission per user
		// for handling conficting inherited (folder) and non-inherited (dashboard) user permissions
		userPermissionsMap := make(map[int64]*dashboardACL, len(items))
		// teamPermissionsMap is a map keeping the highest permission per team
		// for handling conficting inherited (folder) and non-inherited (dashboard) team permissions
		teamPermissionsMap := make(map[int64]*dashboardACL, len(items))
		for _, item := range items {
			if item.UserID != 0 {
				acl, ok := userPermissionsMap[item.UserID]
				if !ok {
					userPermissionsMap[item.UserID] = item
				} else {
					if item.Permission > acl.Permission {
						// the higher permission wins
						userPermissionsMap[item.UserID] = item
					}
				}
			}

			if item.TeamID != 0 {
				acl, ok := teamPermissionsMap[item.TeamID]
				if !ok {
					teamPermissionsMap[item.TeamID] = item
				} else {
					if item.Permission > acl.Permission {
						// the higher permission wins
						teamPermissionsMap[item.TeamID] = item
					}
				}
			}
		}

		type keyType struct {
			UserID     int64 `xorm:"user_id"`
			TeamID     int64 `xorm:"team_id"`
			Role       roleType
			Permission permissionType
		}
		// seen keeps track of inserted perrmissions to avoid duplicates (due to inheritance)
		seen := make(map[keyType]struct{}, len(items))
		for _, item := range items {
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return dashboards.ErrDashboardACLInfoMissing
			}

			// ignore duplicate user permissions
			if item.UserID != 0 {
				acl, ok := userPermissionsMap[item.UserID]
				if ok {
					if acl.Id != item.Id {
						continue
					}
				}
			}

			// ignore duplicate team permissions
			if item.TeamID != 0 {
				acl, ok := teamPermissionsMap[item.TeamID]
				if ok {
					if acl.Id != item.Id {
						continue
					}
				}
			}

			key := keyType{UserID: item.UserID, TeamID: item.TeamID, Role: "", Permission: item.Permission}
			if item.Role != nil {
				key.Role = *item.Role
			}
			if _, ok := seen[key]; ok {
				continue
			}

			// unset Id so that the new record will get a different one
			item.Id = 0
			item.OrgID = orgID
			item.DashboardID = dashboardID
			item.Created = time.Now()
			item.Updated = time.Now()

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
			seen[key] = struct{}{}
		}

		// Update dashboard HasACL flag
		dashboard := dashboards.Dashboard{HasACL: true}
		_, err := sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)

		return err
	})
}

// based on SQLStore.GetDashboardACLInfoList()
func (m *folderHelper) getACL(ctx context.Context, orgID, dashboardID int64) ([]*dashboardACL, error) {
	var err error

	falseStr := m.dialect.BooleanStr(false)

	result := make([]*dashboardACL, 0)
	rawSQL := `
			-- get distinct permissions for the dashboard and its parent folder
			SELECT DISTINCT
				da.id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id  OR
				(
					-- include default permissions --
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`
	err = m.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(rawSQL, orgID, dashboardID).Find(&result)
	})
	if err != nil {
		return nil, err
	}
	return result, err
}
