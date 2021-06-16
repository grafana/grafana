package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/util"
)

var shadowSearchCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Subsystem: "db_dashboard",
		Name:      "search_shadow",
	},
	[]string{"equal", "error"},
)

func init() {
	bus.AddHandler("sql", GetDashboard)
	bus.AddHandler("sql", GetDashboards)
	bus.AddHandlerCtx("sql", GetDashboardCtx)
	bus.AddHandler("sql", DeleteDashboard)
	bus.AddHandler("sql", SearchDashboards)
	bus.AddHandler("sql", GetDashboardTags)
	bus.AddHandler("sql", GetDashboardSlugById)
	bus.AddHandler("sql", GetDashboardUIDById)
	bus.AddHandler("sql", GetDashboardsByPluginId)
	bus.AddHandler("sql", GetDashboardPermissionsForUser)
	bus.AddHandler("sql", GetDashboardsBySlug)
	bus.AddHandler("sql", HasEditPermissionInFolders)
	bus.AddHandler("sql", HasAdminPermissionInFolders)

	prometheus.MustRegister(shadowSearchCounter)
}

var generateNewUid func() string = util.GenerateShortUID

func (ss *SQLStore) SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error) {
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		return saveDashboard(sess, &cmd)
	})
	return cmd.Result, err
}

func saveDashboard(sess *DBSession, cmd *models.SaveDashboardCommand) error {
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
			if _, err := sess.Insert(&DashboardTag{DashboardId: dash.Id, Term: tag}); err != nil {
				return err
			}
		}
	}

	cmd.Result = dash

	return nil
}

func generateNewDashboardUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

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

// GetDashboard gets a dashboard.
func (ss *SQLStore) GetDashboard(id, orgID int64, uid, slug string) (*models.Dashboard, error) {
	if id == 0 && slug == "" && uid == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	dashboard := models.Dashboard{Slug: slug, OrgId: orgID, Id: id, Uid: uid}
	has, err := ss.engine.Get(&dashboard)
	if err != nil {
		return nil, err
	} else if !has {
		return nil, models.ErrDashboardNotFound
	}

	dashboard.SetId(dashboard.Id)
	dashboard.SetUid(dashboard.Uid)
	return &dashboard, nil
}

// GetDashboardByTitle gets a dashboard by its title.
func (ss *SQLStore) GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error) {
	if title == "" {
		return nil, models.ErrDashboardIdentifierNotSet
	}

	// there is a unique constraint on org_id, folder_id, title
	// there are no nested folders so the parent folder id is always 0
	dashboard := models.Dashboard{OrgId: orgID, FolderId: 0, Title: title}
	has, err := ss.engine.Get(&dashboard)
	if err != nil {
		return nil, err
	} else if !has {
		return nil, models.ErrDashboardNotFound
	}

	// if there is a dashboard instead of a folder with that title
	if !dashboard.IsFolder {
		return nil, models.ErrDashboardNotFound
	}

	dashboard.SetId(dashboard.Id)
	dashboard.SetUid(dashboard.Uid)
	return &dashboard, nil
}

// TODO: Remove me
func GetDashboard(query *models.GetDashboardQuery) error {
	return GetDashboardCtx(context.Background(), query)
}

func GetDashboardCtx(ctx context.Context, query *models.GetDashboardQuery) error {
	return withDbSession(ctx, x, func(dbSession *DBSession) error {
		if query.Id == 0 && len(query.Slug) == 0 && len(query.Uid) == 0 {
			return models.ErrDashboardIdentifierNotSet
		}

		dashboard := models.Dashboard{Slug: query.Slug, OrgId: query.OrgId, Id: query.Id, Uid: query.Uid}
		has, err := dbSession.Get(&dashboard)

		if err != nil {
			return err
		} else if !has {
			return models.ErrDashboardNotFound
		}

		dashboard.SetId(dashboard.Id)
		dashboard.SetUid(dashboard.Uid)
		query.Result = &dashboard
		return nil
	})
}

type DashboardSearchProjection struct {
	ID          int64  `xorm:"id"`
	UID         string `xorm:"uid"`
	Title       string
	Slug        string
	Term        string
	IsFolder    bool
	FolderID    int64  `xorm:"folder_id"`
	FolderUID   string `xorm:"folder_uid"`
	FolderSlug  string
	FolderTitle string
	SortMeta    int64
}

func findDashboards(query *search.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error) {
	filters := []interface{}{
		permissions.DashboardPermissionFilter{
			OrgRole:         query.SignedInUser.OrgRole,
			OrgId:           query.SignedInUser.OrgId,
			Dialect:         dialect,
			UserId:          query.SignedInUser.UserId,
			PermissionLevel: query.Permission,
		},
	}

	for _, filter := range query.Sort.Filter {
		filters = append(filters, filter)
	}

	if query.OrgId != 0 {
		filters = append(filters, searchstore.OrgFilter{OrgId: query.OrgId})
	} else if query.SignedInUser.OrgId != 0 {
		filters = append(filters, searchstore.OrgFilter{OrgId: query.SignedInUser.OrgId})
	}

	if len(query.Tags) > 0 {
		filters = append(filters, searchstore.TagsFilter{Tags: query.Tags})
	}

	if len(query.DashboardIds) > 0 {
		filters = append(filters, searchstore.DashboardFilter{IDs: query.DashboardIds})
	}

	if query.IsStarred {
		filters = append(filters, searchstore.StarredFilter{UserId: query.SignedInUser.UserId})
	}

	if len(query.Title) > 0 {
		filters = append(filters, searchstore.TitleFilter{Dialect: dialect, Title: query.Title})
	}

	if len(query.Type) > 0 {
		filters = append(filters, searchstore.TypeFilter{Dialect: dialect, Type: query.Type})
	}

	if len(query.FolderIds) > 0 {
		filters = append(filters, searchstore.FolderFilter{IDs: query.FolderIds})
	}

	var res []DashboardSearchProjection
	sb := &searchstore.Builder{Dialect: dialect, Filters: filters}

	limit := query.Limit
	if limit < 1 {
		limit = 1000
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	sql, params := sb.ToSQL(limit, page)
	err := x.SQL(sql, params...).Find(&res)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func SearchDashboards(query *search.FindPersistedDashboardsQuery) error {
	res, err := findDashboards(query)
	if err != nil {
		return err
	}

	makeQueryResult(query, res)

	return nil
}

func getHitType(item DashboardSearchProjection) search.HitType {
	var hitType search.HitType
	if item.IsFolder {
		hitType = search.DashHitFolder
	} else {
		hitType = search.DashHitDB
	}

	return hitType
}

func makeQueryResult(query *search.FindPersistedDashboardsQuery, res []DashboardSearchProjection) {
	query.Result = make([]*search.Hit, 0)
	hits := make(map[int64]*search.Hit)

	for _, item := range res {
		hit, exists := hits[item.ID]
		if !exists {
			hit = &search.Hit{
				ID:          item.ID,
				UID:         item.UID,
				Title:       item.Title,
				URI:         "db/" + item.Slug,
				URL:         models.GetDashboardFolderUrl(item.IsFolder, item.UID, item.Slug),
				Type:        getHitType(item),
				FolderID:    item.FolderID,
				FolderUID:   item.FolderUID,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

			if item.FolderID > 0 {
				hit.FolderURL = models.GetFolderUrl(item.FolderUID, item.FolderSlug)
			}

			if query.Sort.MetaName != "" {
				hit.SortMeta = item.SortMeta
				hit.SortMetaName = query.Sort.MetaName
			}

			query.Result = append(query.Result, hit)
			hits[item.ID] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}
}

func GetDashboardTags(query *models.GetDashboardTagsQuery) error {
	sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id
					WHERE dashboard.org_id=?
					GROUP BY term
					ORDER BY term`

	query.Result = make([]*models.DashboardTagCloudItem, 0)
	sess := x.SQL(sql, query.OrgId)
	err := sess.Find(&query.Result)
	return err
}

func DeleteDashboard(cmd *models.DeleteDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		return deleteDashboard(cmd, sess)
	})
}

func deleteDashboard(cmd *models.DeleteDashboardCommand, sess *DBSession) error {
	dashboard := models.Dashboard{Id: cmd.Id, OrgId: cmd.OrgId}
	has, err := sess.Get(&dashboard)
	if err != nil {
		return err
	} else if !has {
		return models.ErrDashboardNotFound
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

		dashIds := []struct {
			Id int64
		}{}
		err := sess.SQL("SELECT id FROM dashboard WHERE folder_id = ?", dashboard.Id).Find(&dashIds)
		if err != nil {
			return err
		}

		for _, id := range dashIds {
			if err := deleteAlertDefinition(id.Id, sess); err != nil {
				return err
			}
		}

		if len(dashIds) > 0 {
			childrenDeletes := []string{
				"DELETE FROM dashboard_tag WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
				"DELETE FROM star WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
				"DELETE FROM dashboard_version WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
				"DELETE FROM annotation WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
				"DELETE FROM dashboard_provisioning WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
				"DELETE FROM dashboard_acl WHERE dashboard_id IN (SELECT id FROM dashboard WHERE org_id = ? AND folder_id = ?)",
			}
			for _, sql := range childrenDeletes {
				_, err := sess.Exec(sql, dashboard.OrgId, dashboard.Id)
				if err != nil {
					return err
				}
			}
		}

		// clean ngalert tables
		ngalertDeletes := []string{
			"DELETE FROM alert_rule WHERE namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)",
			"DELETE FROM alert_rule_version WHERE rule_namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)",
		}

		for _, sql := range ngalertDeletes {
			_, err := sess.Exec(sql, dashboard.Id)
			if err != nil {
				return err
			}
		}
	}

	if err := deleteAlertDefinition(dashboard.Id, sess); err != nil {
		return err
	}

	for _, sql := range deletes {
		_, err := sess.Exec(sql, dashboard.Id)
		if err != nil {
			return err
		}
	}

	return nil
}

func GetDashboards(query *models.GetDashboardsQuery) error {
	if len(query.DashboardIds) == 0 {
		return models.ErrCommandValidationFailed
	}

	var dashboards = make([]*models.Dashboard, 0)

	err := x.In("id", query.DashboardIds).Find(&dashboards)
	query.Result = dashboards
	return err
}

// GetDashboardPermissionsForUser returns the maximum permission the specified user has for a dashboard(s)
// The function takes in a list of dashboard ids and the user id and role
func GetDashboardPermissionsForUser(query *models.GetDashboardPermissionsForUserQuery) error {
	if len(query.DashboardIds) == 0 {
		return models.ErrCommandValidationFailed
	}

	if query.OrgRole == models.ROLE_ADMIN {
		var permissions = make([]*models.DashboardPermissionForUser, 0)
		for _, d := range query.DashboardIds {
			permissions = append(permissions, &models.DashboardPermissionForUser{
				DashboardId:    d,
				Permission:     models.PERMISSION_ADMIN,
				PermissionName: models.PERMISSION_ADMIN.String(),
			})
		}
		query.Result = permissions

		return nil
	}

	params := make([]interface{}, 0)

	// check dashboards that have ACLs via user id, team id or role
	sql := `SELECT d.id AS dashboard_id, MAX(COALESCE(da.permission, pt.permission)) AS permission
	FROM dashboard AS d
		LEFT JOIN dashboard_acl as da on d.folder_id = da.dashboard_id or d.id = da.dashboard_id
		LEFT JOIN team_member as ugm on ugm.team_id =  da.team_id
		LEFT JOIN org_user ou ON ou.role = da.role AND ou.user_id = ?
	`
	params = append(params, query.UserId)

	// check the user's role for dashboards that do not have hasAcl set
	sql += `LEFT JOIN org_user ouRole ON ouRole.user_id = ? AND ouRole.org_id = ?`
	params = append(params, query.UserId)
	params = append(params, query.OrgId)

	sql += `
		LEFT JOIN (SELECT 1 AS permission, 'Viewer' AS role
			UNION SELECT 2 AS permission, 'Editor' AS role
			UNION SELECT 4 AS permission, 'Admin' AS role) pt ON ouRole.role = pt.role
	WHERE
	d.Id IN (?` + strings.Repeat(",?", len(query.DashboardIds)-1) + `) `
	for _, id := range query.DashboardIds {
		params = append(params, id)
	}

	sql += ` AND
	d.org_id = ? AND
	  (
		(d.has_acl = ?  AND (da.user_id = ? OR ugm.user_id = ? OR ou.id IS NOT NULL))
		OR (d.has_acl = ? AND ouRole.id IS NOT NULL)
	)
	group by d.id
	order by d.id asc`
	params = append(params, query.OrgId)
	params = append(params, dialect.BooleanStr(true))
	params = append(params, query.UserId)
	params = append(params, query.UserId)
	params = append(params, dialect.BooleanStr(false))

	err := x.SQL(sql, params...).Find(&query.Result)

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return err
}

func GetDashboardsByPluginId(query *models.GetDashboardsByPluginIdQuery) error {
	var dashboards = make([]*models.Dashboard, 0)
	whereExpr := "org_id=? AND plugin_id=? AND is_folder=" + dialect.BooleanStr(false)

	err := x.Where(whereExpr, query.OrgId, query.PluginId).Find(&dashboards)
	query.Result = dashboards
	return err
}

type DashboardSlugDTO struct {
	Slug string
}

func GetDashboardSlugById(query *models.GetDashboardSlugByIdQuery) error {
	var rawSQL = `SELECT slug from dashboard WHERE Id=?`
	var slug = DashboardSlugDTO{}

	exists, err := x.SQL(rawSQL, query.Id).Get(&slug)

	if err != nil {
		return err
	} else if !exists {
		return models.ErrDashboardNotFound
	}

	query.Result = slug.Slug
	return nil
}

func GetDashboardsBySlug(query *models.GetDashboardsBySlugQuery) error {
	var dashboards []*models.Dashboard

	if err := x.Where("org_id=? AND slug=?", query.OrgId, query.Slug).Find(&dashboards); err != nil {
		return err
	}

	query.Result = dashboards
	return nil
}

func GetDashboardUIDById(query *models.GetDashboardRefByIdQuery) error {
	var rawSQL = `SELECT uid, slug from dashboard WHERE Id=?`

	us := &models.DashboardRef{}

	exists, err := x.SQL(rawSQL, query.Id).Get(us)

	if err != nil {
		return err
	} else if !exists {
		return models.ErrDashboardNotFound
	}

	query.Result = us
	return nil
}

func getExistingDashboardByIdOrUidForUpdate(sess *DBSession, dash *models.Dashboard, overwrite bool) (bool, error) {
	dashWithIdExists := false
	isParentFolderChanged := false
	var existingById models.Dashboard

	if dash.Id > 0 {
		var err error
		dashWithIdExists, err = sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existingById)
		if err != nil {
			return isParentFolderChanged, fmt.Errorf("SQL query for existing dashboard by ID failed: %w", err)
		}

		if !dashWithIdExists {
			return isParentFolderChanged, models.ErrDashboardNotFound
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
			return isParentFolderChanged, fmt.Errorf("SQL query for existing dashboard by UID failed: %w", err)
		}
	}

	if dash.FolderId > 0 {
		var existingFolder models.Dashboard
		folderExists, err := sess.Where("org_id=? AND id=? AND is_folder=?", dash.OrgId, dash.FolderId,
			dialect.BooleanStr(true)).Get(&existingFolder)
		if err != nil {
			return isParentFolderChanged, fmt.Errorf("SQL query for folder failed: %w", err)
		}

		if !folderExists {
			return isParentFolderChanged, models.ErrDashboardFolderNotFound
		}
	}

	if !dashWithIdExists && !dashWithUidExists {
		return isParentFolderChanged, nil
	}

	if dashWithIdExists && dashWithUidExists && existingById.Id != existingByUid.Id {
		return isParentFolderChanged, models.ErrDashboardWithSameUIDExists
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

func getExistingDashboardByTitleAndFolder(sess *DBSession, dash *models.Dashboard, overwrite,
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

func (ss *SQLStore) ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error) {
	isParentFolderChanged := false
	err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		var err error
		isParentFolderChanged, err = getExistingDashboardByIdOrUidForUpdate(sess, dashboard, overwrite)
		if err != nil {
			return err
		}

		isParentFolderChanged, err = getExistingDashboardByTitleAndFolder(sess, dashboard, overwrite,
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

func HasEditPermissionInFolders(query *models.HasEditPermissionInFoldersQuery) error {
	if query.SignedInUser.HasRole(models.ROLE_EDITOR) {
		query.Result = true
		return nil
	}

	builder := &SQLBuilder{}
	builder.Write("SELECT COUNT(dashboard.id) AS count FROM dashboard WHERE dashboard.org_id = ? AND dashboard.is_folder = ?",
		query.SignedInUser.OrgId, dialect.BooleanStr(true))
	builder.WriteDashboardPermissionFilter(query.SignedInUser, models.PERMISSION_EDIT)

	type folderCount struct {
		Count int64
	}

	resp := make([]*folderCount, 0)
	if err := x.SQL(builder.GetSQLString(), builder.params...).Find(&resp); err != nil {
		return err
	}

	query.Result = len(resp) > 0 && resp[0].Count > 0

	return nil
}

func HasAdminPermissionInFolders(query *models.HasAdminPermissionInFoldersQuery) error {
	if query.SignedInUser.HasRole(models.ROLE_ADMIN) {
		query.Result = true
		return nil
	}

	builder := &SQLBuilder{}
	builder.Write("SELECT COUNT(dashboard.id) AS count FROM dashboard WHERE dashboard.org_id = ? AND dashboard.is_folder = ?", query.SignedInUser.OrgId, dialect.BooleanStr(true))
	builder.WriteDashboardPermissionFilter(query.SignedInUser, models.PERMISSION_ADMIN)

	type folderCount struct {
		Count int64
	}

	resp := make([]*folderCount, 0)
	if err := x.SQL(builder.GetSQLString(), builder.params...).Find(&resp); err != nil {
		return err
	}

	query.Result = len(resp) > 0 && resp[0].Count > 0

	return nil
}
