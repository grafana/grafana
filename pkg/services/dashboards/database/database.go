package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

type DashboardStore struct {
	sqlStore *sqlstore.SQLStore
	log      log.Logger
}

func ProvideDashboardStore(sqlStore *sqlstore.SQLStore) *DashboardStore {
	return &DashboardStore{sqlStore: sqlStore, log: log.New("dashboard-store")}
}

func (d *DashboardStore) ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error) {
	isParentFolderChanged := false
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var err error
		isParentFolderChanged, err = getExistingDashboardByIdOrUidForUpdate(sess, dashboard, d.sqlStore.Dialect, overwrite)
		if err != nil {
			return err
		}

		isParentFolderChanged, err = getExistingDashboardByTitleAndFolder(sess, dashboard, d.sqlStore.Dialect, overwrite,
			isParentFolderChanged)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return false, err
	}

	return isParentFolderChanged, nil
}

func (d *DashboardStore) GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error) {
	if title == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	// there is a unique constraint on org_id, folder_id, title
	// there are no nested folders so the parent folder id is always 0
	dashboard := models.Dashboard{OrgId: orgID, FolderId: 0, Title: title}
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err := sess.Table(&models.Dashboard{}).Where("is_folder = " + d.sqlStore.Dialect.BooleanStr(true)).Where("folder_id=0").Get(&dashboard)
		if err != nil {
			return err
		}
		if !has {
			return models.ErrDashboardNotFound
		}
		dashboard.SetId(dashboard.Id)
		dashboard.SetUid(dashboard.Uid)
		return nil
	})
	return &dashboard, err
}

func (d *DashboardStore) GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	var data models.DashboardProvisioning
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Where("dashboard_id = ?", dashboardID).Get(&data)
		return err
	})

	if data.DashboardId == 0 {
		return nil, nil
	}
	return &data, err
}

func (d *DashboardStore) GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error) {
	var provisionedDashboard models.DashboardProvisioning
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var dashboard models.Dashboard
		exists, err := sess.Where("org_id = ? AND uid = ?", orgID, dashboardUID).Get(&dashboard)
		if err != nil {
			return err
		}
		if !exists {
			return models.
				ErrDashboardNotFound
		}
		exists, err = sess.Where("dashboard_id = ?", dashboard.Id).Get(&provisionedDashboard)
		if err != nil {
			return err
		}
		if !exists {
			return models.ErrProvisionedDashboardNotFound
		}
		return nil
	})
	return &provisionedDashboard, err
}

func (d *DashboardStore) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	var result []*models.DashboardProvisioning
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Where("name = ?", name).Find(&result)
	})
	return result, err
}

func (d *DashboardStore) SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if err := saveDashboard(sess, &cmd); err != nil {
			return err
		}

		if provisioning.Updated == 0 {
			provisioning.Updated = cmd.Result.Updated.Unix()
		}

		return saveProvisionedData(sess, provisioning, cmd.Result)
	})

	return cmd.Result, err
}

func (d *DashboardStore) SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error) {
	err := d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return saveDashboard(sess, &cmd)
	})
	return cmd.Result, err
}

func (d *DashboardStore) UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*models.DashboardAcl) error {
	return d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// delete existing items
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return models.ErrDashboardAclInfoMissing
			}

			if item.DashboardID == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasAcl flag
		dashboard := models.Dashboard{HasAcl: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
}

func (d *DashboardStore) SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error {
	return d.sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		existingAlerts, err := GetAlertsByDashboardId2(dashID, sess)
		if err != nil {
			return err
		}

		if err := updateAlerts(existingAlerts, alerts, sess, d.log); err != nil {
			return err
		}

		if err := deleteMissingAlerts(existingAlerts, alerts, sess, d.log); err != nil {
			return err
		}

		return nil
	})
}

// UnprovisionDashboard removes row in dashboard_provisioning for the dashboard making it seem as if manually created.
// The dashboard will still have `created_by = -1` to see it was not created by any particular user.
func (d *DashboardStore) UnprovisionDashboard(ctx context.Context, id int64) error {
	return d.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Where("dashboard_id = ?", id).Delete(&models.DashboardProvisioning{})
		return err
	})
}

func getExistingDashboardByIdOrUidForUpdate(sess *sqlstore.DBSession, dash *models.Dashboard, dialect migrator.Dialect, overwrite bool) (bool, error) {
	dashWithIdExists := false
	isParentFolderChanged := false
	var existingById models.Dashboard

	if dash.Id > 0 {
		var err error
		dashWithIdExists, err = sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existingById)
		if err != nil {
			return false, fmt.Errorf("SQL query for existing dashboard by ID failed: %w", err)
		}

		if !dashWithIdExists {
			return false, models.ErrDashboardNotFound
		}

		if dash.Uid == "" {
			dash.SetUid(existingById.Uid)
		}
	}

	dashWithUidExists := false
	var existingByUid models.Dashboard

	if dash.Uid != "" {
		var err error
		dashWithUidExists, err = sess.Where("org_id=? AND uid=?", dash.OrgId, dash.Uid).Get(&existingByUid)
		if err != nil {
			return false, fmt.Errorf("SQL query for existing dashboard by UID failed: %w", err)
		}
	}

	if dash.FolderId > 0 {
		var existingFolder models.Dashboard
		folderExists, err := sess.Where("org_id=? AND id=? AND is_folder=?", dash.OrgId, dash.FolderId,
			dialect.BooleanStr(true)).Get(&existingFolder)
		if err != nil {
			return false, fmt.Errorf("SQL query for folder failed: %w", err)
		}

		if !folderExists {
			return false, models.ErrDashboardFolderNotFound
		}
	}

	if !dashWithIdExists && !dashWithUidExists {
		return false, nil
	}

	if dashWithIdExists && dashWithUidExists && existingById.Id != existingByUid.Id {
		return false, models.ErrDashboardWithSameUIDExists
	}

	existing := existingById

	if !dashWithIdExists && dashWithUidExists {
		dash.SetId(existingByUid.Id)
		dash.SetUid(existingByUid.Uid)
		existing = existingByUid

		if !dash.IsFolder {
			isParentFolderChanged = true
		}
	}

	if (existing.IsFolder && !dash.IsFolder) ||
		(!existing.IsFolder && dash.IsFolder) {
		return isParentFolderChanged, models.ErrDashboardTypeMismatch
	}

	if !dash.IsFolder && dash.FolderId != existing.FolderId {
		isParentFolderChanged = true
	}

	// check for is someone else has written in between
	if dash.Version != existing.Version {
		if overwrite {
			dash.SetVersion(existing.Version)
		} else {
			return isParentFolderChanged, models.ErrDashboardVersionMismatch
		}
	}

	// do not allow plugin dashboard updates without overwrite flag
	if existing.PluginId != "" && !overwrite {
		return isParentFolderChanged, models.UpdatePluginDashboardError{PluginId: existing.PluginId}
	}

	return isParentFolderChanged, nil
}

func getExistingDashboardByTitleAndFolder(sess *sqlstore.DBSession, dash *models.Dashboard, dialect migrator.Dialect, overwrite,
	isParentFolderChanged bool) (bool, error) {
	var existing models.Dashboard
	exists, err := sess.Where("org_id=? AND slug=? AND (is_folder=? OR folder_id=?)", dash.OrgId, dash.Slug,
		dialect.BooleanStr(true), dash.FolderId).Get(&existing)
	if err != nil {
		return isParentFolderChanged, fmt.Errorf("SQL query for existing dashboard by org ID or folder ID failed: %w", err)
	}

	if exists && dash.Id != existing.Id {
		if existing.IsFolder && !dash.IsFolder {
			return isParentFolderChanged, models.ErrDashboardWithSameNameAsFolder
		}

		if !existing.IsFolder && dash.IsFolder {
			return isParentFolderChanged, models.ErrDashboardFolderWithSameNameAsDashboard
		}

		if !dash.IsFolder && (dash.FolderId != existing.FolderId || dash.Id == 0) {
			isParentFolderChanged = true
		}

		if overwrite {
			dash.SetId(existing.Id)
			dash.SetUid(existing.Uid)
			dash.SetVersion(existing.Version)
		} else {
			return isParentFolderChanged, models.ErrDashboardWithSameNameInFolderExists
		}
	}

	return isParentFolderChanged, nil
}

func saveDashboard(sess *sqlstore.DBSession, cmd *models.SaveDashboardCommand) error {
	dash := cmd.GetDashboardModel()

	userId := cmd.UserId

	if userId == 0 {
		userId = -1
	}

	if dash.Id > 0 {
		var existing models.Dashboard
		dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existing)
		if err != nil {
			return err
		}
		if !dashWithIdExists {
			return models.ErrDashboardNotFound
		}

		// check for is someone else has written in between
		if dash.Version != existing.Version {
			if cmd.Overwrite {
				dash.SetVersion(existing.Version)
			} else {
				return models.ErrDashboardVersionMismatch
			}
		}

		// do not allow plugin dashboard updates without overwrite flag
		if existing.PluginId != "" && !cmd.Overwrite {
			return models.UpdatePluginDashboardError{PluginId: existing.PluginId}
		}
	}

	if dash.Uid == "" {
		uid, err := generateNewDashboardUid(sess, dash.OrgId)
		if err != nil {
			return err
		}
		dash.SetUid(uid)
	}

	parentVersion := dash.Version
	var affectedRows int64
	var err error

	if dash.Id == 0 {
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.CreatedBy = userId
		dash.Updated = time.Now()
		dash.UpdatedBy = userId
		metrics.MApiDashboardInsert.Inc()
		affectedRows, err = sess.Insert(dash)
	} else {
		dash.SetVersion(dash.Version + 1)

		if !cmd.UpdatedAt.IsZero() {
			dash.Updated = cmd.UpdatedAt
		} else {
			dash.Updated = time.Now()
		}

		dash.UpdatedBy = userId

		affectedRows, err = sess.MustCols("folder_id").ID(dash.Id).Update(dash)
	}

	if err != nil {
		return err
	}

	if affectedRows == 0 {
		return models.ErrDashboardNotFound
	}

	dashVersion := &models.DashboardVersion{
		DashboardId:   dash.Id,
		ParentVersion: parentVersion,
		RestoredFrom:  cmd.RestoredFrom,
		Version:       dash.Version,
		Created:       time.Now(),
		CreatedBy:     dash.UpdatedBy,
		Message:       cmd.Message,
		Data:          dash.Data,
	}

	// insert version entry
	if affectedRows, err = sess.Insert(dashVersion); err != nil {
		return err
	} else if affectedRows == 0 {
		return models.ErrDashboardNotFound
	}

	// delete existing tags
	_, err = sess.Exec("DELETE FROM dashboard_tag WHERE dashboard_id=?", dash.Id)
	if err != nil {
		return err
	}

	// insert new tags
	tags := dash.GetTags()
	if len(tags) > 0 {
		for _, tag := range tags {
			if _, err := sess.Insert(&sqlstore.DashboardTag{DashboardId: dash.Id, Term: tag}); err != nil {
				return err
			}
		}
	}

	cmd.Result = dash

	return nil
}

func generateNewDashboardUid(sess *sqlstore.DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.Dashboard{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrDashboardFailedGenerateUniqueUid
}

func saveProvisionedData(sess *sqlstore.DBSession, provisioning *models.DashboardProvisioning, dashboard *models.Dashboard) error {
	result := &models.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=? AND name = ?", dashboard.Id, provisioning.Name).Get(result)
	if err != nil {
		return err
	}

	provisioning.Id = result.Id
	provisioning.DashboardId = dashboard.Id

	if exist {
		_, err = sess.ID(result.Id).Update(provisioning)
	} else {
		_, err = sess.Insert(provisioning)
	}

	return err
}

func GetAlertsByDashboardId2(dashboardId int64, sess *sqlstore.DBSession) ([]*models.Alert, error) {
	alerts := make([]*models.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*models.Alert{}, err
	}

	return alerts, nil
}

func updateAlerts(existingAlerts []*models.Alert, alerts []*models.Alert, sess *sqlstore.DBSession, log log.Logger) error {
	for _, alert := range alerts {
		update := false
		var alertToUpdate *models.Alert

		for _, k := range existingAlerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
				alertToUpdate = k
				break
			}
		}

		if update {
			if alertToUpdate.ContainsUpdates(alert) {
				alert.Updated = time.Now()
				alert.State = alertToUpdate.State
				sess.MustCols("message", "for")

				_, err := sess.ID(alert.Id).Update(alert)
				if err != nil {
					return err
				}

				log.Debug("Alert updated", "name", alert.Name, "id", alert.Id)
			}
		} else {
			alert.Updated = time.Now()
			alert.Created = time.Now()
			alert.State = models.AlertStateUnknown
			alert.NewStateDate = time.Now()

			_, err := sess.Insert(alert)
			if err != nil {
				return err
			}

			log.Debug("Alert inserted", "name", alert.Name, "id", alert.Id)
		}
		tags := alert.GetTagsFromSettings()
		if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alert.Id); err != nil {
			return err
		}
		if tags != nil {
			tags, err := EnsureTagsExist(sess, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO alert_rule_tag (alert_id, tag_id) VALUES(?,?)", alert.Id, tag.Id); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []*models.Alert, existingAlerts []*models.Alert, sess *sqlstore.DBSession, log log.Logger) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range existingAlerts {
			if missingAlert.PanelId == k.PanelId {
				missing = false
				break
			}
		}

		if missing {
			if err := deleteAlertByIdInternal(missingAlert.Id, "Removed from dashboard", sess, log); err != nil {
				// No use trying to delete more, since we're in a transaction and it will be
				// rolled back on error.
				return err
			}
		}
	}

	return nil
}

func deleteAlertByIdInternal(alertId int64, reason string, sess *sqlstore.DBSession, log log.Logger) error {
	log.Debug("Deleting alert", "id", alertId, "reason", reason)

	if _, err := sess.Exec("DELETE FROM alert WHERE id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM annotation WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM alert_notification_state WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	return nil
}

func EnsureTagsExist(sess *sqlstore.DBSession, tags []*models.Tag) ([]*models.Tag, error) {
	for _, tag := range tags {
		var existingTag models.Tag

		// check if it exists
		exists, err := sess.Table("tag").Where("`key`=? AND `value`=?", tag.Key, tag.Value).Get(&existingTag)
		if err != nil {
			return nil, err
		}
		if exists {
			tag.Id = existingTag.Id
		} else {
			_, err := sess.Table("tag").Insert(tag)
			if err != nil {
				return nil, err
			}
		}
	}

	return tags, nil
}
