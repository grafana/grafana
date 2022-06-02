package sqlstore

import (
	"context"

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
