package database

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboard/database")

type dashboardStore struct {
	store      db.DB
	cfg        *setting.Cfg
	log        log.Logger
	features   featuremgmt.FeatureToggles
	tagService tag.Service
}

// SQL bean helper to save tags
type dashboardTag struct {
	Id           int64
	OrgID        int64 `xorm:"org_id"`
	DashboardId  int64
	DashboardUID string `xorm:"dashboard_uid"`
	Term         string
}

// DashboardStore implements the Store interface
var _ dashboards.Store = (*dashboardStore)(nil)

func ProvideDashboardStore(sqlStore db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tagService tag.Service) (dashboards.Store, error) {
	s := &dashboardStore{store: sqlStore, cfg: cfg, log: log.New("dashboard-store"), features: features, tagService: tagService}

	// fill out dashboard_uid and org_id for dashboard_tags
	// need to run this at startup in case any downgrade happened after the initial migration
	err := migrations.RunDashboardTagMigrations(sqlStore.GetEngine().NewSession(), sqlStore.GetDialect().DriverName())
	if err != nil {
		s.log.Error("Failed to run dashboard_tag migrations", "err", err)
	}

	return s, nil
}

func (d *dashboardStore) emitEntityEvent() bool {
	return d.features != nil && d.features.IsEnabledGlobally(featuremgmt.FlagPanelTitleSearch)
}

func (d *dashboardStore) GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetDashboardsByLibraryPanelUID")
	defer span.End()

	connectedDashboards := make([]*dashboards.DashboardRef, 0)
	recursiveQueriesAreSupported, err := d.store.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	err = d.store.WithDbSession(ctx, func(session *db.Session) error {
		builder := db.NewSqlBuilder(d.cfg, d.features, d.store.GetDialect(), recursiveQueriesAreSupported)
		builder.Write("SELECT d.*")
		builder.Write(" FROM " + model.LibraryElementConnectionTableName + " AS lec")
		builder.Write(" INNER JOIN " + model.LibraryElementTableName + " AS le ON lec.element_id = le.id")
		builder.Write(" INNER JOIN dashboard AS d ON lec.connection_id = d.id")
		builder.Write(` WHERE le.uid=? AND le.org_id=?`, libraryPanelUID, orgID)
		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&connectedDashboards); err != nil {
			return err
		}

		return nil
	})

	return connectedDashboards, err
}

func (d *dashboardStore) ValidateDashboardBeforeSave(ctx context.Context, dash *dashboards.Dashboard, overwrite bool) (bool, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.ValidateDashboardBeforesave")
	defer span.End()

	isParentFolderChanged := false
	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		dashWithIdExists := false
		var existingById dashboards.Dashboard

		// we don't save FolderID in kubernetes object when saving through k8s
		// this block guarantees we save dashboards with folder_id and folder_uid in those cases
		if !dash.IsFolder && dash.FolderUID != "" && dash.FolderID == 0 { // nolint:staticcheck
			var existing dashboards.Dashboard
			folderIdFound, err := sess.Where("uid=? AND org_id=?", dash.FolderUID, dash.OrgID).Get(&existing)
			if err != nil {
				return err
			}

			if folderIdFound {
				dash.FolderID = existing.ID // nolint:staticcheck
			} else {
				return dashboards.ErrDashboardFolderNotFound
			}
		}

		if dash.ID > 0 {
			var err error
			dashWithIdExists, err = sess.Where("id=? AND org_id=?", dash.ID, dash.OrgID).Get(&existingById)
			if err != nil {
				return fmt.Errorf("SQL query for existing dashboard by ID failed: %w", err)
			}

			if !dashWithIdExists {
				return dashboards.ErrDashboardNotFound
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
				return fmt.Errorf("SQL query for existing dashboard by UID failed: %w", err)
			}
		}

		if !dashWithIdExists && !dashWithUidExists {
			return nil
		}

		if dashWithIdExists && dashWithUidExists && existingById.ID != existingByUid.ID {
			return dashboards.ErrDashboardWithSameUIDExists
		}

		existing := existingById

		if !dashWithIdExists && dashWithUidExists {
			dash.SetID(existingByUid.ID)
			dash.SetUID(existingByUid.UID)
			existing = existingByUid
		}

		if (existing.IsFolder && !dash.IsFolder) ||
			(!existing.IsFolder && dash.IsFolder) {
			return dashboards.ErrDashboardTypeMismatch
		}

		if !dash.IsFolder && dash.FolderUID != existing.FolderUID {
			isParentFolderChanged = true
		}

		// check for is someone else has written in between
		if dash.Version != existing.Version {
			if overwrite {
				dash.SetVersion(existing.Version)
			} else {
				return dashboards.ErrDashboardVersionMismatch
			}
		}

		// do not allow plugin dashboard updates without overwrite flag
		if existing.PluginID != "" && !overwrite {
			return dashboards.UpdatePluginDashboardError{PluginId: existing.PluginID}
		}

		return nil
	})

	if err != nil {
		return false, err
	}

	return isParentFolderChanged, nil
}

func (d *dashboardStore) GetProvisionedDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioningSearchResults, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetProvisionedDataByDashboardID")
	defer span.End()

	data := []*dashboards.DashboardProvisioningSearchResults{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(`dashboard`).
			Join(`INNER`, `dashboard_provisioning`, `dashboard.id = dashboard_provisioning.dashboard_id`).
			Where(`dashboard_provisioning.dashboard_id = ?`, dashboardID).
			Select("dashboard.*, dashboard_provisioning.name, dashboard_provisioning.external_id, dashboard_provisioning.updated as provisioning_updated, dashboard_provisioning.check_sum").
			Find(&data)
	})
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, nil
	}

	return data[0], nil
}

func (d *dashboardStore) GetProvisionedDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioningSearchResults, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetProvisionedDataByDashboardUID")
	defer span.End()

	provisionedDashboard := []*dashboards.DashboardProvisioningSearchResults{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		var dashboard dashboards.Dashboard
		exists, err := sess.Where("org_id = ? AND uid = ?", orgID, dashboardUID).Get(&dashboard)
		if err != nil {
			return err
		}
		if !exists {
			return dashboards.ErrDashboardNotFound
		}

		return sess.Table(`dashboard`).
			Join(`INNER`, `dashboard_provisioning`, `dashboard.id = dashboard_provisioning.dashboard_id`).
			Where(`dashboard_provisioning.dashboard_id = ?`, dashboard.ID).
			Select("dashboard.*, dashboard_provisioning.name, dashboard_provisioning.external_id, dashboard_provisioning.updated as provisioning_updated, dashboard_provisioning.check_sum").
			Find(&provisionedDashboard)
	})
	if err != nil {
		return nil, err
	}

	if len(provisionedDashboard) == 0 {
		return nil, dashboards.ErrProvisionedDashboardNotFound
	}

	return provisionedDashboard[0], nil
}

func (d *dashboardStore) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetProvisionedDashboardData")
	defer span.End()

	var result []*dashboards.DashboardProvisioning
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("name = ?", name).Find(&result)
	})
	return result, err
}

func (d *dashboardStore) GetProvisionedDashboardsByName(ctx context.Context, name string, orgID int64) ([]*dashboards.DashboardProvisioningSearchResults, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetProvisionedDashboardsByName")
	defer span.End()

	dashes := []*dashboards.DashboardProvisioningSearchResults{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(`dashboard`).
			Join(`INNER`, `dashboard_provisioning`, `dashboard.id = dashboard_provisioning.dashboard_id`).
			Where(`dashboard_provisioning.name = ? AND dashboard.org_id = ?`, name, orgID).
			Select("dashboard.*, dashboard_provisioning.name, dashboard_provisioning.external_id, dashboard_provisioning.updated as provisioning_updated, dashboard_provisioning.check_sum").
			Find(&dashes)
	})
	if err != nil {
		return nil, err
	}
	return dashes, nil
}

func (d *dashboardStore) GetOrphanedProvisionedDashboards(ctx context.Context, notIn []string, orgID int64) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetOrphanedProvisionedDashboards")
	defer span.End()

	dashes := []*dashboards.Dashboard{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(`dashboard`).
			Join(`INNER`, `dashboard_provisioning`, `dashboard.id = dashboard_provisioning.dashboard_id`).
			Where(`dashboard.org_id = ?`, orgID).
			NotIn(`dashboard_provisioning.name`, notIn).Find(&dashes)
	})
	if err != nil {
		return nil, err
	}
	return dashes, nil
}

func (d *dashboardStore) SaveProvisionedDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.SaveProvisionedDashboard")
	defer span.End()

	var result *dashboards.Dashboard
	var err error
	err = d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		result, err = d.saveDashboard(ctx, sess, &cmd, d.emitEntityEvent())
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
	ctx, span := tracer.Start(ctx, "dashboards.database.SaveDashboard")
	defer span.End()

	var result *dashboards.Dashboard
	var err error
	err = d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		result, err = d.saveDashboard(ctx, sess, &cmd, d.emitEntityEvent())
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

// UnprovisionDashboard removes row in dashboard_provisioning for the dashboard making it seem as if manually created.
// The dashboard will still have `created_by = -1` to see it was not created by any particular user.
func (d *dashboardStore) UnprovisionDashboard(ctx context.Context, id int64) error {
	ctx, span := tracer.Start(ctx, "dashboards.database.UnprovisionDashboard")
	defer span.End()

	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Where("dashboard_id = ?", id).Delete(&dashboards.DashboardProvisioning{})
		return err
	})
}

func (d *dashboardStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.Count")
	defer span.End()

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

func (d *dashboardStore) CountInOrg(ctx context.Context, orgID int64, isFolder bool) (int64, error) {
	type result struct {
		Count int64
	}
	r := result{}
	if err := d.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM dashboard WHERE org_id=? AND is_folder=%s", d.store.GetDialect().BooleanStr(isFolder))
		if _, err := sess.SQL(rawSQL, orgID).Get(&r); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return 0, err
	}

	return r.Count, nil
}

func (d *dashboardStore) saveDashboard(ctx context.Context, sess *db.Session, cmd *dashboards.SaveDashboardCommand, emitEntityEvent bool) (*dashboards.Dashboard, error) {
	dash := cmd.GetDashboardModel()

	isParentFolderChanged, err := d.ValidateDashboardBeforeSave(ctx, dash, cmd.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		d.log.Debug("Dashboard parent folder has changed", "dashboard", dash.UID, "newFolder", dash.FolderUID)
	}

	if dash.UID == "" {
		dash.SetUID(util.GenerateShortUID())
	}

	parentVersion := dash.Version
	var affectedRows int64

	if dash.ID == 0 {
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.CreatedBy = dash.UpdatedBy
		dash.Updated = time.Now()
		metrics.MApiDashboardInsert.Inc()
		affectedRows, err = sess.Nullable("folder_uid").Insert(dash)
	} else {
		dash.SetVersion(dash.Version + 1)

		if !cmd.UpdatedAt.IsZero() {
			dash.Updated = cmd.UpdatedAt
		} else {
			dash.Updated = time.Now()
		}

		affectedRows, err = sess.MustCols("folder_id", "folder_uid").Nullable("folder_uid").ID(dash.ID).Update(dash)
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
		APIVersion:    cmd.APIVersion,
	}

	// insert version entry
	if affectedRows, err = sess.Insert(dashVersion); err != nil {
		return nil, err
	} else if affectedRows == 0 {
		return nil, dashboards.ErrDashboardNotFound
	}

	// delete existing tags
	if _, err = sess.Exec("DELETE FROM dashboard_tag WHERE dashboard_uid=? AND org_id=?", dash.UID, dash.OrgID); err != nil {
		return nil, err
	}

	// insert new tags
	tags := dash.GetTags()
	if len(tags) > 0 {
		for _, tag := range tags {
			if _, err := sess.Insert(dashboardTag{DashboardId: dash.ID, Term: tag, OrgID: dash.OrgID, DashboardUID: dash.UID}); err != nil {
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

func (d *dashboardStore) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetDashboardsByPluginID")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "dashboards.database.DeleteDashboard")
	defer span.End()

	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return d.deleteDashboard(cmd, sess, d.emitEntityEvent())
	})
}

func (d *dashboardStore) deleteDashboard(cmd *dashboards.DeleteDashboardCommand, sess *db.Session, emitEntityEvent bool) error {
	dashboard := dashboards.Dashboard{OrgID: cmd.OrgID}
	if cmd.UID != "" {
		dashboard.UID = cmd.UID
	} else {
		dashboard.ID = cmd.ID
	}
	has, err := sess.Get(&dashboard)
	if err != nil {
		return err
	} else if !has {
		return dashboards.ErrDashboardNotFound
	}

	type statement struct {
		SQL  string
		args []any
	}

	sqlStatements := []statement{
		{SQL: "DELETE FROM dashboard_tag WHERE dashboard_uid = ? AND org_id = ?", args: []any{dashboard.UID, dashboard.OrgID}},
		{SQL: "DELETE FROM star WHERE dashboard_id = ? ", args: []any{dashboard.ID}},
		{SQL: "DELETE FROM dashboard WHERE id = ?", args: []any{dashboard.ID}},
		{SQL: "DELETE FROM playlist_item WHERE type = 'dashboard_by_id' AND value = ?", args: []any{strconv.FormatInt(dashboard.ID, 10)}}, // Column has TEXT type.
		{SQL: "DELETE FROM dashboard_version WHERE dashboard_id = ?", args: []any{dashboard.ID}},
		{SQL: "DELETE FROM dashboard_provisioning WHERE dashboard_id = ?", args: []any{dashboard.ID}},
		{SQL: "DELETE FROM dashboard_acl WHERE dashboard_id = ?", args: []any{dashboard.ID}},
	}

	if dashboard.IsFolder {
		sqlStatements = append(sqlStatements, statement{
			SQL:  "DELETE FROM dashboard WHERE org_id = ? AND folder_uid = ? AND is_folder = ? AND deleted IS NULL",
			args: []any{dashboard.OrgID, dashboard.UID, d.store.GetDialect().BooleanValue(false)},
		})

		if err := d.deleteChildrenDashboardAssociations(sess, &dashboard); err != nil {
			return err
		}

		if !cmd.SkipRemovePermissions {
			// remove all access control permission with folder scope
			err := d.deleteResourcePermissions(sess, dashboard.OrgID, dashboards.ScopeFoldersProvider.GetResourceScopeUID(dashboard.UID))
			if err != nil {
				return err
			}
		}
	} else {
		if err := d.deleteResourcePermissions(sess, dashboard.OrgID, ac.GetResourceScopeUID("dashboards", dashboard.UID)); err != nil {
			return err
		}
	}

	_, err = sess.Exec("DELETE FROM annotation WHERE dashboard_id = ? AND org_id = ?", dashboard.ID, dashboard.OrgID)
	if err != nil {
		return err
	}

	for _, stmnt := range sqlStatements {
		_, err := sess.Exec(append([]any{stmnt.SQL}, stmnt.args...)...)
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

func (d *dashboardStore) CleanupAfterDelete(ctx context.Context, cmd *dashboards.DeleteDashboardCommand) error {
	type statement struct {
		SQL  string
		args []any
	}
	sqlStatements := []statement{
		{SQL: "DELETE FROM dashboard_tag WHERE dashboard_uid = ? AND org_id = ?", args: []any{cmd.UID, cmd.OrgID}},
		{SQL: "DELETE FROM star WHERE dashboard_uid = ? AND org_id = ?", args: []any{cmd.UID, cmd.OrgID}},
		{SQL: "DELETE FROM playlist_item WHERE type = 'dashboard_by_id' AND value = ?", args: []any{strconv.FormatInt(cmd.ID, 10)}}, // Column has TEXT type.
		{SQL: "DELETE FROM dashboard_version WHERE dashboard_id = ?", args: []any{cmd.ID}},
		{SQL: "DELETE FROM dashboard_provisioning WHERE dashboard_id = ?", args: []any{cmd.ID}},
		{SQL: "DELETE FROM dashboard_acl WHERE dashboard_id = ?", args: []any{cmd.ID}},
		{SQL: "DELETE FROM annotation WHERE dashboard_id = ? AND org_id = ?", args: []any{cmd.ID, cmd.OrgID}},
	}

	err := d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
			for _, stmnt := range sqlStatements {
				_, err := sess.Exec(append([]any{stmnt.SQL}, stmnt.args...)...)
				if err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return err
		}

		if err := d.deleteResourcePermissions(sess, cmd.OrgID, ac.GetResourceScopeUID("dashboards", cmd.UID)); err != nil {
			return err
		}

		return nil
	})

	return err
}

// FIXME: Remove me and handle nested deletions in the service with the DashboardPermissionsService
func (d *dashboardStore) deleteResourcePermissions(sess *db.Session, orgID int64, resourceScope string) error {
	// retrieve all permissions for the resource scope and org id
	var permissionIDs []int64
	err := sess.SQL("SELECT permission.id FROM permission INNER JOIN role ON permission.role_id = role.id WHERE permission.scope = ? AND role.org_id = ?", resourceScope, orgID).Find(&permissionIDs)
	if err != nil {
		return err
	}

	if len(permissionIDs) == 0 {
		return nil
	}

	// delete the permissions
	_, err = sess.In("id", permissionIDs).Delete(&ac.Permission{})
	return err
}

func (d *dashboardStore) deleteChildrenDashboardAssociations(sess *db.Session, dashboard *dashboards.Dashboard) error {
	var dashIds []struct {
		Id  int64
		Uid string
	}
	err := sess.SQL("SELECT id, uid FROM dashboard WHERE folder_id = ?", dashboard.ID).Find(&dashIds)
	if err != nil {
		return err
	}

	if len(dashIds) > 0 {
		for _, dash := range dashIds {
			// remove all access control permission with child dashboard scopes
			if err := d.deleteResourcePermissions(sess, dashboard.OrgID, ac.GetResourceScopeUID("dashboards", dash.Uid)); err != nil {
				return err
			}
		}

		childrenDeletes := []string{
			"DELETE FROM dashboard_tag WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM star WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_version WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_provisioning WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			"DELETE FROM dashboard_acl WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
		}

		_, err = sess.Exec("DELETE FROM annotation WHERE org_id = ? AND dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)", dashboard.OrgID, dashboard.OrgID, dashboard.ID)
		if err != nil {
			return err
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

func (d *dashboardStore) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetDashboard")
	defer span.End()

	var queryResult *dashboards.Dashboard
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		if query.ID == 0 && len(query.UID) == 0 && (query.Title == nil || (query.FolderID == nil && query.FolderUID == nil)) {
			return dashboards.ErrDashboardIdentifierNotSet
		}

		dashboard := dashboards.Dashboard{OrgID: query.OrgID, ID: query.ID, UID: query.UID}
		mustCols := []string{}
		if query.Title != nil { // nolint:staticcheck
			dashboard.Title = *query.Title // nolint:staticcheck
			mustCols = append(mustCols, "title")
		}

		if query.FolderUID != nil {
			dashboard.FolderUID = *query.FolderUID
			mustCols = append(mustCols, "folder_uid")
		} else if query.FolderID != nil { // nolint:staticcheck
			dashboard.FolderID = *query.FolderID // nolint:staticcheck
			mustCols = append(mustCols, "folder_id")
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		}

		has, err := sess.Where("deleted IS NULL").MustCols(mustCols...).Nullable("folder_uid").Get(&dashboard)
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

func (d *dashboardStore) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.FindDashboards")
	defer span.End()

	recursiveQueriesAreSupported, err := d.store.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	filters := []any{}

	for _, filter := range query.Sort.Filter {
		filters = append(filters, filter)
	}

	filters = append(filters, query.Filters...)

	var orgID int64
	if query.OrgId != 0 {
		orgID = query.OrgId
		filters = append(filters, searchstore.OrgFilter{OrgId: orgID})
	} else if query.SignedInUser.GetOrgID() != 0 {
		orgID = query.SignedInUser.GetOrgID()
		filters = append(filters, searchstore.OrgFilter{OrgId: orgID})
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
		filters = append(filters, searchstore.TitleFilter{Dialect: d.store.GetDialect(), Title: query.Title, TitleExactMatch: query.TitleExactMatch})
	}

	if len(query.Type) > 0 {
		filters = append(filters, searchstore.TypeFilter{Dialect: d.store.GetDialect(), Type: query.Type})
	}
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if len(query.FolderIds) > 0 {
		filters = append(filters, searchstore.FolderFilter{IDs: query.FolderIds})
	}

	if len(query.FolderUIDs) > 0 {
		filters = append(filters, searchstore.FolderUIDFilter{
			Dialect: d.store.GetDialect(),
			OrgID:   orgID,
			UIDs:    query.FolderUIDs,
		})
	}

	// only list k6 folders when requested by a service account - prevents showing k6 folders in the UI for users
	if query.SignedInUser == nil || !query.SignedInUser.IsIdentityType(claims.TypeServiceAccount) {
		filters = append(filters, searchstore.K6FolderFilter{})
	}

	if !query.SkipAccessControlFilter {
		filters = append(filters, permissions.NewAccessControlDashboardPermissionFilter(query.SignedInUser, query.Permission, query.Type, d.features, recursiveQueriesAreSupported, d.store.GetDialect()))
	}

	filters = append(filters, searchstore.DeletedFilter{Deleted: query.IsDeleted})

	var res []dashboards.DashboardSearchProjection
	sb := &searchstore.Builder{Dialect: d.store.GetDialect(), Filters: filters, Features: d.features}

	limit := query.Limit
	if limit < 1 {
		limit = 1000
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	sql, params := sb.ToSQL(limit, page)

	err = d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql, params...).Find(&res)
	})

	if err != nil {
		return nil, err
	}

	if len(res) <= 1 {
		return res, nil
	}

	// the search query above will return one row per dashboard tag, and dashboards
	// can have multiple tags. we only want to return one row per dashboard, so dedup
	// the results by id.
	// note: we must preserve the order of the results as we dedup, as the query can be sorted
	seen := make(map[int64]int)
	uniqueRes := make([]dashboards.DashboardSearchProjection, 0, len(res))

	for _, item := range res {
		if idx, exists := seen[item.ID]; exists {
			if item.Term != "" {
				if uniqueRes[idx].Tags == nil {
					uniqueRes[idx].Tags = make([]string, 0)
				}
				uniqueRes[idx].Tags = append(uniqueRes[idx].Tags, item.Term)
			}
			continue
		}

		if item.Tags == nil {
			item.Tags = make([]string, 0)
		}
		if item.Term != "" {
			item.Tags = append(item.Tags, item.Term)
		}
		if item.FolderTitle != "" {
			item.FolderSlug = slugify.Slugify(item.FolderTitle)
		}
		seen[item.ID] = len(uniqueRes)
		uniqueRes = append(uniqueRes, item)
	}

	return uniqueRes, nil
}

func (d *dashboardStore) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetDashboardTags")
	defer span.End()

	queryResult := make([]*dashboards.DashboardTagCloudItem, 0)
	err := d.store.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_uid = dashboard.uid
					WHERE dashboard_tag.org_id=?
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

func (d *dashboardStore) DeleteDashboardsInFolders(
	ctx context.Context, req *dashboards.DeleteDashboardsInFolderRequest) error {
	ctx, span := tracer.Start(ctx, "dashboards.database.DeleteDashboardsInFolders")
	defer span.End()

	return d.store.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		// TODO delete all dashboards in the folder in a bulk query
		for _, folderUID := range req.FolderUIDs {
			dashboard := dashboards.Dashboard{OrgID: req.OrgID}
			has, err := sess.Where("org_id = ? AND uid = ?", req.OrgID, folderUID).Get(&dashboard)
			if err != nil {
				return err
			}
			if !has {
				return dashboards.ErrFolderNotFound
			}

			if err := d.deleteChildrenDashboardAssociations(sess, &dashboard); err != nil {
				return err
			}

			_, err = sess.Where("folder_id = ? AND org_id = ? AND is_folder = ?", dashboard.ID, dashboard.OrgID, false).Delete(&dashboards.Dashboard{})
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (d *dashboardStore) GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.database.GetAllDashboardsByOrgId")
	defer span.End()

	var dashs = make([]*dashboards.Dashboard, 0)
	err := d.store.WithDbSession(ctx, func(session *db.Session) error {
		// "deleted IS NULL" is to avoid deleted dashboards
		return session.Where("org_id = ? AND deleted IS NULL", orgID).Find(&dashs)
	})
	if err != nil {
		return nil, err
	}
	return dashs, nil
}
