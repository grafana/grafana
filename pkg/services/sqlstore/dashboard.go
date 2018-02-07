package sqlstore

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", SaveDashboard)
	bus.AddHandler("sql", GetDashboard)
	bus.AddHandler("sql", GetDashboards)
	bus.AddHandler("sql", DeleteDashboard)
	bus.AddHandler("sql", SearchDashboards)
	bus.AddHandler("sql", GetDashboardTags)
	bus.AddHandler("sql", GetDashboardSlugById)
	bus.AddHandler("sql", GetDashboardUIDById)
	bus.AddHandler("sql", GetDashboardsByPluginId)
	bus.AddHandler("sql", GetFoldersForSignedInUser)
	bus.AddHandler("sql", GetDashboardPermissionsForUser)
	bus.AddHandler("sql", GetDashboardsBySlug)
}

var generateNewUid func() string = util.GenerateShortUid

func SaveDashboard(cmd *m.SaveDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		dash := cmd.GetDashboardModel()

		// try get existing dashboard
		var existing m.Dashboard

		if dash.Id != 0 {
			dashWithIdExists, err := sess.Where("id=? AND org_id=?", dash.Id, dash.OrgId).Get(&existing)
			if err != nil {
				return err
			}
			if !dashWithIdExists {
				return m.ErrDashboardNotFound
			}

			// check for is someone else has written in between
			if dash.Version != existing.Version {
				if cmd.Overwrite {
					dash.Version = existing.Version
				} else {
					return m.ErrDashboardVersionMismatch
				}
			}

			// do not allow plugin dashboard updates without overwrite flag
			if existing.PluginId != "" && cmd.Overwrite == false {
				return m.UpdatePluginDashboardError{PluginId: existing.PluginId}
			}
		} else if dash.Uid != "" {
			var sameUid m.Dashboard
			sameUidExists, err := sess.Where("org_id=? AND uid=?", dash.OrgId, dash.Uid).Get(&sameUid)
			if err != nil {
				return err
			}

			if sameUidExists {
				// another dashboard with same uid
				if dash.Id != sameUid.Id {
					if cmd.Overwrite {
						dash.Id = sameUid.Id
						dash.Version = sameUid.Version
					} else {
						return m.ErrDashboardWithSameUIDExists
					}
				}
			}
		}

		if dash.Uid == "" {
			uid, err := generateNewDashboardUid(sess, dash.OrgId)
			if err != nil {
				return err
			}
			dash.Uid = uid
			dash.Data.Set("uid", uid)
		}

		err := guaranteeDashboardNameIsUniqueInFolder(sess, dash)
		if err != nil {
			return err
		}

		err = setHasAcl(sess, dash)
		if err != nil {
			return err
		}

		parentVersion := dash.Version
		affectedRows := int64(0)

		if dash.Id == 0 {
			dash.Version = 1
			metrics.M_Api_Dashboard_Insert.Inc()
			dash.Data.Set("version", dash.Version)
			affectedRows, err = sess.Insert(dash)
		} else {
			dash.Version++
			dash.Data.Set("version", dash.Version)

			if !cmd.UpdatedAt.IsZero() {
				dash.Updated = cmd.UpdatedAt
			}

			affectedRows, err = sess.MustCols("folder_id", "has_acl").ID(dash.Id).Update(dash)
		}

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return m.ErrDashboardNotFound
		}

		dashVersion := &m.DashboardVersion{
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
			return m.ErrDashboardNotFound
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

		return err
	})
}

func generateNewDashboardUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&m.Dashboard{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", m.ErrDashboardFailedGenerateUniqueUid
}

func guaranteeDashboardNameIsUniqueInFolder(sess *DBSession, dash *m.Dashboard) error {
	var sameNameInFolder m.Dashboard
	sameNameInFolderExist, err := sess.Where("org_id=? AND title=? AND folder_id = ? AND uid <> ?",
		dash.OrgId, dash.Title, dash.FolderId, dash.Uid).
		Get(&sameNameInFolder)

	if err != nil {
		return err
	}

	if sameNameInFolderExist {
		return m.ErrDashboardWithSameNameInFolderExists
	}

	return nil
}

func setHasAcl(sess *DBSession, dash *m.Dashboard) error {
	// check if parent has acl
	if dash.FolderId > 0 {
		var parent m.Dashboard
		if hasParent, err := sess.Where("folder_id=?", dash.FolderId).Get(&parent); err != nil {
			return err
		} else if hasParent && parent.HasAcl {
			dash.HasAcl = true
		}
	}

	// check if dash has its own acl
	if dash.Id > 0 {
		if res, err := sess.Query("SELECT 1 from dashboard_acl WHERE dashboard_id =?", dash.Id); err != nil {
			return err
		} else {
			if len(res) > 0 {
				dash.HasAcl = true
			}
		}
	}

	return nil
}

func GetDashboard(query *m.GetDashboardQuery) error {
	dashboard := m.Dashboard{Slug: query.Slug, OrgId: query.OrgId, Id: query.Id, Uid: query.Uid}
	has, err := x.Get(&dashboard)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrDashboardNotFound
	}

	dashboard.Data.Set("id", dashboard.Id)
	dashboard.Data.Set("uid", dashboard.Uid)
	query.Result = &dashboard
	return nil
}

type DashboardSearchProjection struct {
	Id          int64
	Uid         string
	Title       string
	Slug        string
	Term        string
	IsFolder    bool
	FolderId    int64
	FolderUid   string
	FolderSlug  string
	FolderTitle string
}

func findDashboards(query *search.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error) {
	limit := query.Limit
	if limit == 0 {
		limit = 1000
	}

	sb := NewSearchBuilder(query.SignedInUser, limit).
		WithTags(query.Tags).
		WithDashboardIdsIn(query.DashboardIds)

	if query.IsStarred {
		sb.IsStarred()
	}

	if len(query.Title) > 0 {
		sb.WithTitle(query.Title)
	}

	if len(query.Type) > 0 {
		sb.WithType(query.Type)
	}

	if len(query.FolderIds) > 0 {
		sb.WithFolderIds(query.FolderIds)
	}

	var res []DashboardSearchProjection

	sql, params := sb.ToSql()
	err := x.Sql(sql, params...).Find(&res)
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
		hit, exists := hits[item.Id]
		if !exists {
			hit = &search.Hit{
				Id:          item.Id,
				Uid:         item.Uid,
				Title:       item.Title,
				Uri:         "db/" + item.Slug,
				Url:         m.GetDashboardFolderUrl(item.IsFolder, item.Uid, item.Slug),
				Type:        getHitType(item),
				FolderId:    item.FolderId,
				FolderUid:   item.FolderUid,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

			if item.FolderId > 0 {
				hit.FolderUrl = m.GetFolderUrl(item.FolderUid, item.FolderSlug)
			}

			query.Result = append(query.Result, hit)
			hits[item.Id] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}
}

func GetDashboardTags(query *m.GetDashboardTagsQuery) error {
	sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id
					WHERE dashboard.org_id=?
					GROUP BY term`

	query.Result = make([]*m.DashboardTagCloudItem, 0)
	sess := x.Sql(sql, query.OrgId)
	err := sess.Find(&query.Result)
	return err
}

func GetFoldersForSignedInUser(query *m.GetFoldersForSignedInUserQuery) error {
	query.Result = make([]*m.DashboardFolder, 0)
	var err error

	if query.SignedInUser.OrgRole == m.ROLE_ADMIN {
		sql := `SELECT distinct d.id, d.title
		FROM dashboard AS d WHERE d.is_folder = ? AND d.org_id = ?
		ORDER BY d.title ASC`

		err = x.Sql(sql, dialect.BooleanStr(true), query.OrgId).Find(&query.Result)
	} else {
		params := make([]interface{}, 0)
		sql := `SELECT distinct d.id, d.title
		FROM dashboard AS d
			LEFT JOIN dashboard_acl AS da ON d.id = da.dashboard_id
			LEFT JOIN team_member AS ugm ON ugm.team_id =  da.team_id
			LEFT JOIN org_user ou ON ou.role = da.role AND ou.user_id = ?
			LEFT JOIN org_user ouRole ON ouRole.role = 'Editor' AND ouRole.user_id = ? AND ouRole.org_id = ?`
		params = append(params, query.SignedInUser.UserId)
		params = append(params, query.SignedInUser.UserId)
		params = append(params, query.OrgId)

		sql += ` WHERE
			d.org_id = ? AND
			d.is_folder = ? AND
			(
				(d.has_acl = ? AND da.permission > 1 AND (da.user_id = ? OR ugm.user_id = ? OR ou.id IS NOT NULL))
				OR (d.has_acl = ? AND ouRole.id IS NOT NULL)
			)`
		params = append(params, query.OrgId)
		params = append(params, dialect.BooleanStr(true))
		params = append(params, dialect.BooleanStr(true))
		params = append(params, query.SignedInUser.UserId)
		params = append(params, query.SignedInUser.UserId)
		params = append(params, dialect.BooleanStr(false))

		if len(query.Title) > 0 {
			sql += " AND d.title " + dialect.LikeStr() + " ?"
			params = append(params, "%"+query.Title+"%")
		}

		sql += ` ORDER BY d.title ASC`
		err = x.Sql(sql, params...).Find(&query.Result)
	}

	return err
}

func DeleteDashboard(cmd *m.DeleteDashboardCommand) error {
	return inTransaction(func(sess *DBSession) error {
		dashboard := m.Dashboard{Id: cmd.Id, OrgId: cmd.OrgId}
		has, err := sess.Get(&dashboard)
		if err != nil {
			return err
		} else if has == false {
			return m.ErrDashboardNotFound
		}

		deletes := []string{
			"DELETE FROM dashboard_tag WHERE dashboard_id = ? ",
			"DELETE FROM star WHERE dashboard_id = ? ",
			"DELETE FROM dashboard WHERE id = ?",
			"DELETE FROM playlist_item WHERE type = 'dashboard_by_id' AND value = ?",
			"DELETE FROM dashboard_version WHERE dashboard_id = ?",
			"DELETE FROM dashboard WHERE folder_id = ?",
			"DELETE FROM annotation WHERE dashboard_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, dashboard.Id)
			if err != nil {
				return err
			}
		}

		if err := DeleteAlertDefinition(dashboard.Id, sess); err != nil {
			return nil
		}

		return nil
	})
}

func GetDashboards(query *m.GetDashboardsQuery) error {
	if len(query.DashboardIds) == 0 {
		return m.ErrCommandValidationFailed
	}

	var dashboards = make([]*m.Dashboard, 0)

	err := x.In("id", query.DashboardIds).Find(&dashboards)
	query.Result = dashboards

	if err != nil {
		return err
	}

	return nil
}

// GetDashboardPermissionsForUser returns the maximum permission the specified user has for a dashboard(s)
// The function takes in a list of dashboard ids and the user id and role
func GetDashboardPermissionsForUser(query *m.GetDashboardPermissionsForUserQuery) error {
	if len(query.DashboardIds) == 0 {
		return m.ErrCommandValidationFailed
	}

	if query.OrgRole == m.ROLE_ADMIN {
		var permissions = make([]*m.DashboardPermissionForUser, 0)
		for _, d := range query.DashboardIds {
			permissions = append(permissions, &m.DashboardPermissionForUser{
				DashboardId:    d,
				Permission:     m.PERMISSION_ADMIN,
				PermissionName: m.PERMISSION_ADMIN.String(),
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

	//check the user's role for dashboards that do not have hasAcl set
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

	x.ShowSQL(true)
	err := x.Sql(sql, params...).Find(&query.Result)
	x.ShowSQL(false)

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return err
}

func GetDashboardsByPluginId(query *m.GetDashboardsByPluginIdQuery) error {
	var dashboards = make([]*m.Dashboard, 0)
	whereExpr := "org_id=? AND plugin_id=? AND is_folder=" + dialect.BooleanStr(false)

	err := x.Where(whereExpr, query.OrgId, query.PluginId).Find(&dashboards)
	query.Result = dashboards

	if err != nil {
		return err
	}

	return nil
}

type DashboardSlugDTO struct {
	Slug string
}

func GetDashboardSlugById(query *m.GetDashboardSlugByIdQuery) error {
	var rawSql = `SELECT slug from dashboard WHERE Id=?`
	var slug = DashboardSlugDTO{}

	exists, err := x.SQL(rawSql, query.Id).Get(&slug)

	if err != nil {
		return err
	} else if exists == false {
		return m.ErrDashboardNotFound
	}

	query.Result = slug.Slug
	return nil
}

func GetDashboardsBySlug(query *m.GetDashboardsBySlugQuery) error {
	var dashboards []*m.Dashboard

	if err := x.Where("org_id=? AND slug=?", query.OrgId, query.Slug).Find(&dashboards); err != nil {
		return err
	}

	query.Result = dashboards
	return nil
}

func GetDashboardUIDById(query *m.GetDashboardRefByIdQuery) error {
	var rawSql = `SELECT uid, slug from dashboard WHERE Id=?`

	us := &m.DashboardRef{}

	exists, err := x.SQL(rawSql, query.Id).Get(us)

	if err != nil {
		return err
	} else if exists == false {
		return m.ErrDashboardNotFound
	}

	query.Result = us
	return nil
}
