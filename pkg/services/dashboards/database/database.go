package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	alertmodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type dashboardStore struct {
	store      db.DB
	cfg        *setting.Cfg
	log        log.Logger
	features   featuremgmt.FeatureToggles
	tagService tag.Service
}

// SQL bean helper to save tags
type dashboardTag struct {
	Id          int64
	DashboardId int64
	Term        string
}

// DashboardStore implements the Store interface
var _ dashboards.Store = (*dashboardStore)(nil)

func ProvideDashboardStore(sqlStore db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tagService tag.Service, quotaService quota.Service) (dashboards.Store, error) {
	s := &dashboardStore{store: sqlStore, cfg: cfg, log: log.New("dashboard-store"), features: features, tagService: tagService}

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return nil, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     dashboards.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.Count,
	}); err != nil {
		return nil, err
	}

	return s, nil
}

func (d *dashboardStore) emitEntityEvent() bool {
	return d.features != nil && d.features.IsEnabled(featuremgmt.FlagPanelTitleSearch)
}

func (d *dashboardStore) ValidateDashboardBeforeSave(ctx context.Context, dashboard *dashboards.Dashboard, overwrite bool) (bool, error) {
	isParentFolderChanged := false
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var err error
		isParentFolderChanged, err = getExistingDashboardByIDOrUIDForUpdate(sess, dashboard, d.store.GetDialect(), overwrite)
		if err != nil {
			return err
		}

		isParentFolderChanged, err = getExistingDashboardByTitleAndFolder(sess, dashboard, d.store.GetDialect(), overwrite,
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

func (d *dashboardStore) GetProvisionedDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioning, error) {
	var data dashboards.DashboardProvisioning
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Where("dashboard_id = ?", dashboardID).Get(&data)
		return err
	})

	if data.DashboardID == 0 {
		return nil, nil
	}
	return &data, err
}

func (d *dashboardStore) GetProvisionedDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioning, error) {
	var provisionedDashboard dashboards.DashboardProvisioning
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var dashboard dashboards.Dashboard
		exists, err := sess.Where("org_id = ? AND uid = ?", orgID, dashboardUID).Get(&dashboard)
		if err != nil {
			return err
		}
		if !exists {
			return dashboards.ErrDashboardNotFound
		}
		exists, err = sess.Where("dashboard_id = ?", dashboard.ID).Get(&provisionedDashboard)
		if err != nil {
			return err
		}
		if !exists {
			return dashboards.ErrProvisionedDashboardNotFound
		}
		return nil
	})
	return &provisionedDashboard, err
}

func (d *dashboardStore) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	var result []*dashboards.DashboardProvisioning
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("name = ?", name).Find(&result)
	})
	return result, err
}

func (d *dashboardStore) SaveProvisionedDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	var result *dashboards.Dashboard
	var err error
	err = d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		result, err = saveDashboard(sess, &cmd, d.emitEntityEvent())
		if err != nil {
			return err
		}

		if provisioning.Updated == 0 {
			provisioning.Updated = result.Updated.Unix()
		}

		return saveProvisionedData(sess, provisioning, result)
	})
	return result, err
}

func (d *dashboardStore) SaveDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	var result *dashboards.Dashboard
	var err error
	err = d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		result, err = saveDashboard(sess, &cmd, d.emitEntityEvent())
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, err
}

func (d *dashboardStore) UpdateDashboardACL(ctx context.Context, dashboardID int64, items []*dashboards.DashboardACL) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// delete existing items
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return dashboards.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return dashboards.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := dashboards.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
}

func (d *dashboardStore) SaveAlerts(ctx context.Context, dashID int64, alerts []*alertmodels.Alert) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		existingAlerts, err := GetAlertsByDashboardId2(dashID, sess)
		if err != nil {
			return err
		}

		if err := d.updateAlerts(ctx, existingAlerts, alerts, d.log); err != nil {
			return err
		}

		if err := d.deleteMissingAlerts(existingAlerts, alerts, sess); err != nil {
			return err
		}

		return nil
	})
}

// UnprovisionDashboard removes row in dashboard_provisioning for the dashboard making it seem as if manually created.
// The dashboard will still have `created_by = -1` to see it was not created by any particular user.
func (d *dashboardStore) UnprovisionDashboard(ctx context.Context, id int64) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Where("dashboard_id = ?", id).Delete(&dashboards.DashboardProvisioning{})
		return err
	})
}

func (d *dashboardStore) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *dashboards.DeleteOrphanedProvisionedDashboardsCommand) error {
	return d.store.WithDbSession(ctx, func(sess *db.Session) error {
		var result []*dashboards.DashboardProvisioning

		convertedReaderNames := make([]interface{}, len(cmd.ReaderNames))
		for index, readerName := range cmd.ReaderNames {
			convertedReaderNames[index] = readerName
		}

		err := sess.NotIn("name", convertedReaderNames...).Find(&result)
		if err != nil {
			return err
		}

		for _, deleteDashCommand := range result {
			err := d.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{ID: deleteDashCommand.DashboardID})
			if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
				return err
			}
		}

		return nil
	})
}

func (d *dashboardStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := d.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM dashboard WHERE is_folder=%s", d.store.GetDialect().BooleanStr(false))
		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return u, err
	} else {
		tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
		if err != nil {
			return nil, err
		}
		u.Set(tag, r.Count)
	}

	if scopeParams != nil && scopeParams.OrgID != 0 {
		if err := d.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM dashboard WHERE org_id=? AND is_folder=%s", d.store.GetDialect().BooleanStr(false))
			if _, err := sess.SQL(rawSQL, scopeParams.OrgID).Get(&r); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
			if err != nil {
				return nil, err
			}
			u.Set(tag, r.Count)
		}
	}

	return u, nil
}

func getExistingDashboardByIDOrUIDForUpdate(sess *db.Session, dash *dashboards.Dashboard, dialect migrator.Dialect, overwrite bool) (bool, error) {
	dashWithIdExists := false
	isParentFolderChanged := false
	var existingById dashboards.Dashboard

	if dash.ID > 0 {
		var err error
		dashWithIdExists, err = sess.Where("id=? AND org_id=?", dash.ID, dash.OrgID).Get(&existingById)
		if err != nil {
			return false, fmt.Errorf("SQL query for existing dashboard by ID failed: %w", err)
		}

		if !dashWithIdExists {
			return false, dashboards.ErrDashboardNotFound
		}

		if dash.UID == "" {
			dash.SetUID(existingById.UID)
		}
	}

	dashWithUidExists := false
	var existingByUid dashboards.Dashboard

	if dash.UID != "" {
		var err error
		dashWithUidExists, err = sess.Where("org_id=? AND uid=?", dash.OrgID, dash.UID).Get(&existingByUid)
		if err != nil {
			return false, fmt.Errorf("SQL query for existing dashboard by UID failed: %w", err)
		}
	}

	if dash.FolderID > 0 {
		var existingFolder dashboards.Dashboard
		folderExists, err := sess.Where("org_id=? AND id=? AND is_folder=?", dash.OrgID, dash.FolderID,
			dialect.BooleanStr(true)).Get(&existingFolder)
		if err != nil {
			return false, fmt.Errorf("SQL query for folder failed: %w", err)
		}

		if !folderExists {
			return false, dashboards.ErrDashboardFolderNotFound
		}
	}

	if !dashWithIdExists && !dashWithUidExists {
		return false, nil
	}

	if dashWithIdExists && dashWithUidExists && existingById.ID != existingByUid.ID {
		return false, dashboards.ErrDashboardWithSameUIDExists
	}

	existing := existingById

	if !dashWithIdExists && dashWithUidExists {
		dash.SetID(existingByUid.ID)
		dash.SetUID(existingByUid.UID)
		existing = existingByUid
	}

	if (existing.IsFolder && !dash.IsFolder) ||
		(!existing.IsFolder && dash.IsFolder) {
		return isParentFolderChanged, dashboards.ErrDashboardTypeMismatch
	}

	if !dash.IsFolder && dash.FolderID != existing.FolderID {
		isParentFolderChanged = true
	}

	// check for is someone else has written in between
	if dash.Version != existing.Version {
		if overwrite {
			dash.SetVersion(existing.Version)
		} else {
			return isParentFolderChanged, dashboards.ErrDashboardVersionMismatch
		}
	}

	// do not allow plugin dashboard updates without overwrite flag
	if existing.PluginID != "" && !overwrite {
		return isParentFolderChanged, dashboards.UpdatePluginDashboardError{PluginId: existing.PluginID}
	}

	return isParentFolderChanged, nil
}

func getExistingDashboardByTitleAndFolder(sess *db.Session, dash *dashboards.Dashboard, dialect migrator.Dialect, overwrite,
	isParentFolderChanged bool) (bool, error) {
	var existing dashboards.Dashboard
	exists, err := sess.Where("org_id=? AND slug=? AND (is_folder=? OR folder_id=?)", dash.OrgID, dash.Slug,
		dialect.BooleanStr(true), dash.FolderID).Get(&existing)
	if err != nil {
		return isParentFolderChanged, fmt.Errorf("SQL query for existing dashboard by org ID or folder ID failed: %w", err)
	}

	if exists && dash.ID != existing.ID {
		if existing.IsFolder && !dash.IsFolder {
			return isParentFolderChanged, dashboards.ErrDashboardWithSameNameAsFolder
		}

		if !existing.IsFolder && dash.IsFolder {
			return isParentFolderChanged, dashboards.ErrDashboardFolderWithSameNameAsDashboard
		}

		if !dash.IsFolder && (dash.FolderID != existing.FolderID || dash.ID == 0) {
			isParentFolderChanged = true
		}

		if overwrite {
			dash.SetID(existing.ID)
			dash.SetUID(existing.UID)
			dash.SetVersion(existing.Version)
		} else {
			return isParentFolderChanged, dashboards.ErrDashboardWithSameNameInFolderExists
		}
	}

	return isParentFolderChanged, nil
}

func saveDashboard(sess *db.Session, cmd *dashboards.SaveDashboardCommand, emitEntityEvent bool) (*dashboards.Dashboard, error) {
	dash := cmd.GetDashboardModel()

	userId := cmd.UserID

	if userId == 0 {
		userId = -1
	}

	if dash.ID > 0 {
		var existing dashboards.Dashboard
		dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.ID, dash.OrgID).Get(&existing)
		if err != nil {
			return nil, err
		}
		if !dashWithIdExists {
			return nil, dashboards.ErrDashboardNotFound
		}

		// check for is someone else has written in between
		if dash.Version != existing.Version {
			if cmd.Overwrite {
				dash.SetVersion(existing.Version)
			} else {
				return nil, dashboards.ErrDashboardVersionMismatch
			}
		}

		// do not allow plugin dashboard updates without overwrite flag
		if existing.PluginID != "" && !cmd.Overwrite {
			return nil, dashboards.UpdatePluginDashboardError{PluginId: existing.PluginID}
		}
	}

	if dash.UID == "" {
		dash.SetUID(util.GenerateShortUID())
	}

	parentVersion := dash.Version
	var affectedRows int64
	var err error

	if dash.ID == 0 {
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

		affectedRows, err = sess.MustCols("folder_id").ID(dash.ID).Update(dash)
	}

	if err != nil {
		return nil, err
	}

	if affectedRows == 0 {
		return nil, dashboards.ErrDashboardNotFound
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
	if affectedRows, err = sess.Insert(dashVersion); err != nil {
		return nil, err
	} else if affectedRows == 0 {
		return nil, dashboards.ErrDashboardNotFound
	}

	// delete existing tags
	if _, err = sess.Exec("DELETE FROM dashboard_tag WHERE dashboard_id=?", dash.ID); err != nil {
		return nil, err
	}

	// insert new tags
	tags := dash.GetTags()
	if len(tags) > 0 {
		for _, tag := range tags {
			if _, err := sess.Insert(dashboardTag{DashboardId: dash.ID, Term: tag}); err != nil {
				return nil, err
			}
		}
	}

	if emitEntityEvent {
		_, err := sess.Insert(createEntityEvent(dash, store.EntityEventTypeUpdate))
		if err != nil {
			return dash, err
		}
	}
	return dash, nil
}

func saveProvisionedData(sess *db.Session, provisioning *dashboards.DashboardProvisioning, dashboard *dashboards.Dashboard) error {
	result := &dashboards.DashboardProvisioning{}

	exist, err := sess.Where("dashboard_id=? AND name = ?", dashboard.ID, provisioning.Name).Get(result)
	if err != nil {
		return err
	}

	provisioning.ID = result.ID
	provisioning.DashboardID = dashboard.ID

	if exist {
		_, err = sess.ID(result.ID).Update(provisioning)
	} else {
		_, err = sess.Insert(provisioning)
	}

	return err
}

func GetAlertsByDashboardId2(dashboardId int64, sess *db.Session) ([]*alertmodels.Alert, error) {
	alerts := make([]*alertmodels.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*alertmodels.Alert{}, err
	}

	return alerts, nil
}

func (d *dashboardStore) updateAlerts(ctx context.Context, existingAlerts []*alertmodels.Alert, alertsIn []*alertmodels.Alert, log log.Logger) error {
	return d.store.WithDbSession(ctx, func(sess *db.Session) error {
		for _, alert := range alertsIn {
			update := false
			var alertToUpdate *alertmodels.Alert

			for _, k := range existingAlerts {
				if alert.PanelID == k.PanelID {
					update = true
					alert.ID = k.ID
					alertToUpdate = k
					break
				}
			}

			if update {
				if alertToUpdate.ContainsUpdates(alert) {
					alert.Updated = time.Now()
					alert.State = alertToUpdate.State
					sess.MustCols("message", "for")

					_, err := sess.ID(alert.ID).Update(alert)
					if err != nil {
						return err
					}

					log.Debug("Alert updated", "name", alert.Name, "id", alert.ID)
				}
			} else {
				alert.Updated = time.Now()
				alert.Created = time.Now()
				alert.State = alertmodels.AlertStateUnknown
				alert.NewStateDate = time.Now()

				_, err := sess.Insert(alert)
				if err != nil {
					return err
				}

				log.Debug("Alert inserted", "name", alert.Name, "id", alert.ID)
			}
			tags := alert.GetTagsFromSettings()
			if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alert.ID); err != nil {
				return err
			}
			if tags != nil {
				tags, err := d.tagService.EnsureTagsExist(ctx, tags)
				if err != nil {
					return err
				}
				for _, tag := range tags {
					if _, err := sess.Exec("INSERT INTO alert_rule_tag (alert_id, tag_id) VALUES(?,?)", alert.ID, tag.Id); err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}

func (d *dashboardStore) deleteMissingAlerts(alerts []*alertmodels.Alert, existingAlerts []*alertmodels.Alert, sess *db.Session) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range existingAlerts {
			if missingAlert.PanelID == k.PanelID {
				missing = false
				break
			}
		}

		if missing {
			if err := d.deleteAlertByIdInternal(missingAlert.ID, "Removed from dashboard", sess); err != nil {
				// No use trying to delete more, since we're in a transaction and it will be
				// rolled back on error.
				return err
			}
		}
	}

	return nil
}

func (d *dashboardStore) deleteAlertByIdInternal(alertId int64, reason string, sess *db.Session) error {
	d.log.Debug("Deleting alert", "id", alertId, "reason", reason)

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

func (d *dashboardStore) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	var dashboards = make([]*dashboards.Dashboard, 0)
	err := d.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		whereExpr := "org_id=? AND plugin_id=? AND is_folder=" + d.store.GetDialect().BooleanStr(false)

		err := dbSession.Where(whereExpr, query.OrgID, query.PluginID).Find(&dashboards)
		return err
	})
	if err != nil {
		return nil, err
	}
	return dashboards, nil
}

func (d *dashboardStore) DeleteDashboard(ctx context.Context, cmd *dashboards.DeleteDashboardCommand) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return d.deleteDashboard(cmd, sess, d.emitEntityEvent())
	})
}

func (d *dashboardStore) deleteDashboard(cmd *dashboards.DeleteDashboardCommand, sess *db.Session, emitEntityEvent bool) error {
	dashboard := dashboards.Dashboard{ID: cmd.ID, OrgID: cmd.OrgID}
	has, err := sess.Get(&dashboard)
	if err != nil {
		return err
	} else if !has {
		return dashboards.ErrDashboardNotFound
	}

	deletes := []string{
		"DELETE FROM dashboard_tag WHERE dashboard_id = ? ",
		"DELETE FROM star WHERE dashboard_id = ? ",
		"DELETE FROM dashboard WHERE id = ?",
		"DELETE FROM playlist_item WHERE type = 'dashboard_by_id' AND value = ?",
		"DELETE FROM dashboard_version WHERE dashboard_id = ?",
		"DELETE FROM annotation WHERE dashboard_id = ?",
		"DELETE FROM dashboard_provisioning WHERE dashboard_id = ?",
		"DELETE FROM dashboard_acl WHERE dashboard_id = ?",
	}

	if dashboard.IsFolder {
		deletes = append(deletes, "DELETE FROM dashboard WHERE folder_id = ?")

		if err := d.deleteChildrenDashboardAssociations(sess, dashboard); err != nil {
			return err
		}

		// remove all access control permission with folder scope
		_, err = sess.Exec("DELETE FROM permission WHERE scope = ?", dashboards.ScopeFoldersProvider.GetResourceScopeUID(dashboard.UID))
		if err != nil {
			return err
		}

		if err := deleteFolderRules(sess, dashboard, cmd.ForceDeleteFolderRules); err != nil {
			return err
		}
	} else {
		_, err = sess.Exec("DELETE FROM permission WHERE scope = ?", ac.GetResourceScopeUID("dashboards", dashboard.UID))
		if err != nil {
			return err
		}
	}

	if err := d.deleteAlertDefinition(dashboard.ID, sess); err != nil {
		return err
	}

	for _, sql := range deletes {
		_, err := sess.Exec(sql, dashboard.ID)
		if err != nil {
			return err
		}
	}

	if emitEntityEvent {
		_, err := sess.Insert(createEntityEvent(&dashboard, store.EntityEventTypeDelete))
		if err != nil {
			return err
		}
	}
	return nil
}

func (d *dashboardStore) deleteChildrenDashboardAssociations(sess *db.Session, dashboard dashboards.Dashboard) error {
	var dashIds []struct {
		Id  int64
		Uid string
	}
	err := sess.SQL("SELECT id, uid FROM dashboard WHERE folder_id = ?", dashboard.ID).Find(&dashIds)
	if err != nil {
		return err
	}

	if len(dashIds) > 0 {
		for _, id := range dashIds {
			if err := d.deleteAlertDefinition(id.Id, sess); err != nil {
				return err
			}
		}

		// #TODO combine this with previous range block?
		for _, dash := range dashIds {
			// remove all access control permission with child dashboard scopes
			_, err = sess.Exec("DELETE FROM permission WHERE scope = ?", ac.GetResourceScopeUID("dashboards", dash.Uid))
			if err != nil {
				return err
			}
		}

		childrenDeletes := []string{
			"DELETE FROM dashboard_tag WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM star WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_version WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM annotation WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_provisioning WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_acl WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
		}
		for _, sql := range childrenDeletes {
			_, err := sess.Exec(sql, dashboard.OrgID, dashboard.ID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func deleteFolderRules(sess *db.Session, dashboard dashboards.Dashboard, forceDeleteFolderRules bool) error {
	var existingRuleID int64
	exists, err := sess.Table("alert_rule").Where("namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)", dashboard.ID).Cols("id").Get(&existingRuleID)
	if err != nil {
		return err
	}
	if exists {
		if !forceDeleteFolderRules {
			return fmt.Errorf("folder cannot be deleted: %w", dashboards.ErrFolderContainsAlertRules)
		}

		// Delete all rules under this folder.
		deleteNGAlertsByFolder := []string{
			"DELETE FROM alert_rule WHERE namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)",
			"DELETE FROM alert_rule_version WHERE rule_namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)",
		}

		for _, sql := range deleteNGAlertsByFolder {
			_, err := sess.Exec(sql, dashboard.ID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func createEntityEvent(dashboard *dashboards.Dashboard, eventType store.EntityEventType) *store.EntityEvent {
	var entityEvent *store.EntityEvent
	if dashboard.IsFolder {
		entityEvent = &store.EntityEvent{
			EventType: eventType,
			EntityId:  store.CreateDatabaseEntityId(dashboard.UID, dashboard.OrgID, store.EntityTypeFolder),
			Created:   time.Now().Unix(),
		}
	} else {
		entityEvent = &store.EntityEvent{
			EventType: eventType,
			EntityId:  store.CreateDatabaseEntityId(dashboard.UID, dashboard.OrgID, store.EntityTypeDashboard),
			Created:   time.Now().Unix(),
		}
	}
	return entityEvent
}

func (d *dashboardStore) deleteAlertDefinition(dashboardId int64, sess *db.Session) error {
	alerts := make([]*alertmodels.Alert, 0)
	if err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts); err != nil {
		return err
	}

	for _, alert := range alerts {
		if err := d.deleteAlertByIdInternal(alert.ID, "Dashboard deleted", sess); err != nil {
			// If we return an error, the current transaction gets rolled back, so no use
			// trying to delete more
			return err
		}
	}

	return nil
}

func (d *dashboardStore) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	var queryResult *dashboards.Dashboard
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		if query.ID == 0 && len(query.UID) == 0 && (query.Title == nil || query.FolderID == nil) {
			return dashboards.ErrDashboardIdentifierNotSet
		}

		dashboard := dashboards.Dashboard{OrgID: query.OrgID, ID: query.ID, UID: query.UID}
		mustCols := []string{}
		if query.Title != nil {
			dashboard.Title = *query.Title
			mustCols = append(mustCols, "title")
		}
		if query.FolderID != nil {
			dashboard.FolderID = *query.FolderID
			mustCols = append(mustCols, "folder_id")
		}

		has, err := sess.MustCols(mustCols...).Get(&dashboard)

		if err != nil {
			return err
		} else if !has {
			return dashboards.ErrDashboardNotFound
		}

		dashboard.SetID(dashboard.ID)
		dashboard.SetUID(dashboard.UID)
		queryResult = &dashboard
		return nil
	})

	return queryResult, err
}

func (d *dashboardStore) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	us := &dashboards.DashboardRef{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = `SELECT uid, slug from dashboard WHERE Id=?`
		exists, err := sess.SQL(rawSQL, query.ID).Get(us)
		if err != nil {
			return err
		} else if !exists {
			return dashboards.ErrDashboardNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return us, nil
}

func (d *dashboardStore) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	var dashboards = make([]*dashboards.Dashboard, 0)
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		if len(query.DashboardIDs) == 0 && len(query.DashboardUIDs) == 0 {
			return star.ErrCommandValidationFailed
		}
		var session *xorm.Session
		if len(query.DashboardIDs) > 0 {
			session = sess.In("id", query.DashboardIDs)
		} else {
			session = sess.In("uid", query.DashboardUIDs)
		}
		if query.OrgID > 0 {
			session = sess.Where("org_id = ?", query.OrgID)
		}

		err := session.Find(&dashboards)
		return err
	})
	if err != nil {
		return nil, err
	}
	return dashboards, nil
}

func (d *dashboardStore) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	filters := []interface{}{
		permissions.DashboardPermissionFilter{
			OrgRole:         query.SignedInUser.OrgRole,
			OrgId:           query.SignedInUser.OrgID,
			Dialect:         d.store.GetDialect(),
			UserId:          query.SignedInUser.UserID,
			PermissionLevel: query.Permission,
		},
	}

	if !ac.IsDisabled(d.cfg) {
		recursiveQueriesAreSupported, err := d.store.RecursiveQueriesAreSupported()
		if err != nil {
			return nil, err
		}

		// if access control is enabled, overwrite the filters so far
		filters = []interface{}{
			permissions.NewAccessControlDashboardPermissionFilter(query.SignedInUser, query.Permission, query.Type, d.features, recursiveQueriesAreSupported),
		}
	}

	for _, filter := range query.Sort.Filter {
		filters = append(filters, filter)
	}

	filters = append(filters, query.Filters...)

	if query.OrgId != 0 {
		filters = append(filters, searchstore.OrgFilter{OrgId: query.OrgId})
	} else if query.SignedInUser.OrgID != 0 {
		filters = append(filters, searchstore.OrgFilter{OrgId: query.SignedInUser.OrgID})
	}

	if len(query.Tags) > 0 {
		filters = append(filters, searchstore.TagsFilter{Tags: query.Tags})
	}

	if len(query.DashboardUIDs) > 0 {
		filters = append(filters, searchstore.DashboardFilter{UIDs: query.DashboardUIDs})
	} else if len(query.DashboardIds) > 0 {
		filters = append(filters, searchstore.DashboardIDFilter{IDs: query.DashboardIds})
	}

	if len(query.Title) > 0 {
		filters = append(filters, searchstore.TitleFilter{Dialect: d.store.GetDialect(), Title: query.Title})
	}

	if len(query.Type) > 0 {
		filters = append(filters, searchstore.TypeFilter{Dialect: d.store.GetDialect(), Type: query.Type})
	}

	if len(query.FolderIds) > 0 {
		filters = append(filters, searchstore.FolderFilter{IDs: query.FolderIds})
	}

	var res []dashboards.DashboardSearchProjection
	sb := &searchstore.Builder{Dialect: d.store.GetDialect(), Filters: filters}

	limit := query.Limit
	if limit < 1 {
		limit = 1000
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	sql, params := sb.ToSQL(limit, page)

	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql, params...).Find(&res)
	})

	if err != nil {
		return nil, err
	}

	return res, nil
}

func (d *dashboardStore) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	queryResult := make([]*dashboards.DashboardTagCloudItem, 0)
	err := d.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id
					WHERE dashboard.org_id=?
					GROUP BY term
					ORDER BY term`

		sess := dbSession.SQL(sql, query.OrgID)
		err := sess.Find(&queryResult)
		return err
	})
	if err != nil {
		return nil, err
	}
	return queryResult, nil
}

// CountDashboardsInFolder returns a count of all dashboards associated with the
// given parent folder ID.
//
// This will be updated to take CountDashboardsInFolderQuery as an argument and
// lookup dashboards using the ParentFolderUID when dashboards are associated with a parent folder UID instead of ID.
func (d *dashboardStore) CountDashboardsInFolder(
	ctx context.Context, req *dashboards.CountDashboardsInFolderRequest) (int64, error) {
	var count int64
	var err error
	err = d.store.WithDbSession(ctx, func(sess *db.Session) error {
		session := sess.In("folder_id", req.FolderID).In("org_id", req.OrgID).
			In("is_folder", d.store.GetDialect().BooleanStr(false))
		count, err = session.Count(&dashboards.Dashboard{})
		return err
	})
	return count, err
}

func (d *dashboardStore) DeleteDashboardsInFolder(
	ctx context.Context, req *dashboards.DeleteDashboardsInFolderRequest) error {
	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		dashboard := dashboards.Dashboard{OrgID: req.OrgID}
		has, err := sess.Where("uid = ? AND org_id = ?", req.FolderUID, req.OrgID).Get(&dashboard)
		if err != nil {
			return err
		}
		if !has {
			return dashboards.ErrFolderNotFound
		}

		// #TODO figure out where the steps taking place in deleteChildrenAssociations() should live
		// in the context of the registry service. Other implementations for example...
		if err := d.deleteChildrenDashboardAssociations(sess, dashboard); err != nil {
			return err
		}

		_, err = sess.Where("folder_id = ? AND org_id = ? AND is_folder = ?", dashboard.ID, dashboard.OrgID, false).Delete(&dashboards.Dashboard{})
		return err
	})
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return &quota.Map{}, err
	}
	orgQuotaTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
	if err != nil {
		return &quota.Map{}, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.Dashboard)
	limits.Set(orgQuotaTag, cfg.Quota.Org.Dashboard)
	return limits, nil
}
