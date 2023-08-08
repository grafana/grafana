package migration

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
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
	store   db.DB
	dialect migrator.Dialect
}

// getOrCreateGeneralFolder returns the general folder under the specific organisation
// If the general folder does not exist it creates it.
func (m *folderHelper) getOrCreateGeneralFolder(ctx context.Context, orgID int64) (*dashboards.Dashboard, error) {
	// there is a unique constraint on org_id, folder_id, title
	// there are no nested folders so the parent folder id is always 0
	dashboard := dashboards.Dashboard{OrgID: orgID, FolderID: 0, Title: GENERAL_FOLDER}
	err := m.store.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Get(&dashboard)
		if err != nil {
			return err
		} else if !has {
			// create folder
			d, err := m.createGeneralFolder(ctx, orgID)
			if err != nil {
				return err
			}
			dashboard = *d
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &dashboard, nil
}

func (m *folderHelper) createGeneralFolder(ctx context.Context, orgID int64) (*dashboards.Dashboard, error) {
	return m.createFolder(ctx, orgID, GENERAL_FOLDER)
}

// returns the folder of the given dashboard (if exists)
func (m *folderHelper) getFolder(ctx context.Context, dash dashboards.Dashboard, da dashAlert) (dashboards.Dashboard, error) {
	// get folder if exists
	folder := dashboards.Dashboard{}
	if dash.FolderID > 0 {
		err := m.store.WithDbSession(ctx, func(sess *db.Session) error {
			exists, err := sess.Where("id=?", dash.FolderID).Get(&folder)
			if err != nil {
				return fmt.Errorf("failed to get folder %d: %w", dash.FolderID, err)
			}
			if !exists {
				return fmt.Errorf("folder with id %v not found", dash.FolderID)
			}
			if !folder.IsFolder {
				return fmt.Errorf("id %v is a dashboard not a folder", dash.FolderID)
			}
			return nil
		})
		if err != nil {
			return folder, err
		}
	}
	return folder, nil
}

// based on sqlstore.saveDashboard()
// it should be called from inside a transaction
func (m *folderHelper) createFolder(ctx context.Context, orgID int64, title string) (*dashboards.Dashboard, error) {
	var dash *dashboards.Dashboard
	err := m.store.WithDbSession(ctx, func(sess *db.Session) error {
		cmd := dashboards.SaveDashboardCommand{
			OrgID:    orgID,
			FolderID: 0,
			IsFolder: true,
			Dashboard: simplejson.NewFromAny(map[string]any{
				"title": title,
			}),
		}
		dash = cmd.GetDashboardModel()
		dash.SetUID(util.GenerateShortUID())

		parentVersion := dash.Version
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.CreatedBy = FOLDER_CREATED_BY
		dash.Updated = time.Now()
		dash.UpdatedBy = FOLDER_CREATED_BY
		metrics.MApiDashboardInsert.Inc()

		if _, err := sess.Insert(dash); err != nil {
			return err
		}

		dashVersion := &dashver.DashboardVersion{
			DashboardID:   dash.ID,
			ParentVersion: parentVersion,
			RestoredFrom:  cmd.RestoredFrom,
			Version:       dash.Version,
			Created:       time.Now(),
			CreatedBy:     dash.UpdatedBy,
			Message:       cmd.Message,
			Data:          dash.Data,
		}

		// insert version entry
		if _, err := sess.Insert(dashVersion); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return dash, nil
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
