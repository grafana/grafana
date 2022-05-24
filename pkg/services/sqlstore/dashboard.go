package sqlstore

import (
	"context"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/models"
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
	prometheus.MustRegister(shadowSearchCounter)
}

var generateNewUid func() string = util.GenerateShortUID

func (ss *SQLStore) GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		sql := `SELECT
					  COUNT(*) as count,
						term
					FROM dashboard
					INNER JOIN dashboard_tag on dashboard_tag.dashboard_id = dashboard.id
					WHERE dashboard.org_id=?
					GROUP BY term
					ORDER BY term`

		query.Result = make([]*models.DashboardTagCloudItem, 0)
		sess := dbSession.SQL(sql, query.OrgId)
		err := sess.Find(&query.Result)
		return err
	})
}

// GetDashboardPermissionsForUser returns the maximum permission the specified user has for a dashboard(s)
// The function takes in a list of dashboard ids and the user id and role
func (ss *SQLStore) GetDashboardPermissionsForUser(ctx context.Context, query *models.GetDashboardPermissionsForUserQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
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

		err := dbSession.SQL(sql, params...).Find(&query.Result)

		for _, p := range query.Result {
			p.PermissionName = p.Permission.String()
		}

		return err
	})
}

// HasEditPermissionInFolders validates that an user have access to a certain folder
func (ss *SQLStore) HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
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
		if err := dbSession.SQL(builder.GetSQLString(), builder.params...).Find(&resp); err != nil {
			return err
		}

		query.Result = len(resp) > 0 && resp[0].Count > 0

		return nil
	})
}

func (ss *SQLStore) HasAdminPermissionInFolders(ctx context.Context, query *models.HasAdminPermissionInFoldersQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
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
		if err := dbSession.SQL(builder.GetSQLString(), builder.params...).Find(&resp); err != nil {
			return err
		}

		query.Result = len(resp) > 0 && resp[0].Count > 0

		return nil
	})
}
