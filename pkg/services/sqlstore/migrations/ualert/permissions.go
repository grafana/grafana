package ualert

import (
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
)

type roleType string

const (
	ROLE_VIEWER roleType = "Viewer"
	ROLE_EDITOR roleType = "Editor"
	ROLE_ADMIN  roleType = "Admin"
)

func (r roleType) IsValid() bool {
	return r == ROLE_VIEWER || r == ROLE_ADMIN || r == ROLE_EDITOR
}

type permissionType int

type dashboardAcl struct {
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

type folderHelper struct {
	sess *xorm.Session
	mg   *migrator.Migrator
}

// getOrCreateGeneralFolder returns the general folder under the specific organisation
// If the general folder does not exist it creates it.
func (m *folderHelper) getOrCreateGeneralFolder(orgID int64) (*dashboard, error) {
	// there is a unique constraint on org_id, folder_id, title
	// there are no nested folders so the parent folder id is always 0
	dashboard := dashboard{OrgId: orgID, FolderId: 0, Title: GENERAL_FOLDER}
	has, err := m.sess.Get(&dashboard)
	if err != nil {
		return nil, err
	} else if !has {
		// create folder
		return m.createGeneralFolder(orgID)
	}
	return &dashboard, nil
}

func (m *folderHelper) createGeneralFolder(orgID int64) (*dashboard, error) {
	return m.createFolder(orgID, GENERAL_FOLDER)
}

// returns the folder of the given dashboard (if exists)
func (m *folderHelper) getFolder(dash dashboard, da dashAlert) (dashboard, error) {
	// get folder if exists
	folder := dashboard{}
	if dash.FolderId > 0 {
		exists, err := m.sess.Where("id=?", dash.FolderId).Get(&folder)
		if err != nil {
			return folder, fmt.Errorf("failed to get folder %d: %w", dash.FolderId, err)
		}
		if !exists {
			return folder, fmt.Errorf("folder with id %v not found", dash.FolderId)
		}
		if !folder.IsFolder {
			return folder, fmt.Errorf("id %v is a dashboard not a folder", dash.FolderId)
		}
	}
	return folder, nil
}

// based on sqlstore.saveDashboard()
// it should be called from inside a transaction
func (m *folderHelper) createFolder(orgID int64, title string) (*dashboard, error) {
	cmd := saveFolderCommand{
		OrgId:    orgID,
		FolderId: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": title,
		}),
	}
	dash := cmd.getDashboardModel()

	uid, err := m.generateNewDashboardUid(dash.OrgId)
	if err != nil {
		return nil, err
	}
	dash.setUid(uid)

	parentVersion := dash.Version
	dash.setVersion(1)
	dash.Created = time.Now()
	dash.CreatedBy = FOLDER_CREATED_BY
	dash.Updated = time.Now()
	dash.UpdatedBy = FOLDER_CREATED_BY
	metrics.MApiDashboardInsert.Inc()

	if _, err = m.sess.Insert(dash); err != nil {
		return nil, err
	}

	dashVersion := &dashver.DashboardVersion{
		DashboardID:   dash.Id,
		ParentVersion: parentVersion,
		RestoredFrom:  cmd.RestoredFrom,
		Version:       dash.Version,
		Created:       time.Now(),
		CreatedBy:     dash.UpdatedBy,
		Message:       cmd.Message,
		Data:          dash.Data,
	}

	// insert version entry
	if _, err := m.sess.Insert(dashVersion); err != nil {
		return nil, err
	}
	return dash, nil
}

func (m *folderHelper) generateNewDashboardUid(orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := m.sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.Dashboard{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", dashboards.ErrDashboardFailedGenerateUniqueUid
}

// based on SQLStore.UpdateDashboardACL()
// it should be called from inside a transaction
func (m *folderHelper) setACL(orgID int64, dashboardID int64, items []*dashboardAcl) error {
	if dashboardID <= 0 {
		return fmt.Errorf("folder id must be greater than zero for a folder permission")
	}

	// userPermissionsMap is a map keeping the highest permission per user
	// for handling conficting inherited (folder) and non-inherited (dashboard) user permissions
	userPermissionsMap := make(map[int64]*dashboardAcl, len(items))
	// teamPermissionsMap is a map keeping the highest permission per team
	// for handling conficting inherited (folder) and non-inherited (dashboard) team permissions
	teamPermissionsMap := make(map[int64]*dashboardAcl, len(items))
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
			return models.ErrDashboardAclInfoMissing
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

		m.sess.Nullable("user_id", "team_id")
		if _, err := m.sess.Insert(item); err != nil {
			return err
		}
		seen[key] = struct{}{}
	}

	// Update dashboard HasAcl flag
	dashboard := models.Dashboard{HasAcl: true}
	_, err := m.sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
	return err
}

// based on SQLStore.GetDashboardAclInfoList()
func (m *folderHelper) getACL(orgID, dashboardID int64) ([]*dashboardAcl, error) {
	var err error

	falseStr := m.mg.Dialect.BooleanStr(false)

	result := make([]*dashboardAcl, 0)
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
	err = m.sess.SQL(rawSQL, orgID, dashboardID).Find(&result)
	return result, err
}

// getOrgsThatHaveFolders returns a unique list of organization ID that have at least one folder
func (m *folderHelper) getOrgsIDThatHaveFolders() (map[int64]struct{}, error) {
	// get folder if exists
	var rows []int64
	err := m.sess.Table(&dashboard{}).Where("is_folder=?", true).Distinct("org_id").Find(&rows)
	if err != nil {
		return nil, err
	}
	result := make(map[int64]struct{}, len(rows))
	for _, s := range rows {
		result[s] = struct{}{}
	}
	return result, nil
}
