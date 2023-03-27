package statsimpl

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/setting"
)

const activeUserTimeLimit = time.Hour * 24 * 30
const dailyActiveUserTimeLimit = time.Hour * 24

func ProvideService(cfg *setting.Cfg, db db.DB) stats.Service {
	return &sqlStatsService{cfg: cfg, db: db}
}

type sqlStatsService struct {
	db  db.DB
	cfg *setting.Cfg
}

func (ss *sqlStatsService) GetAlertNotifiersUsageStats(ctx context.Context, query *stats.GetAlertNotifierUsageStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type FROM ` + ss.db.GetDialect().Quote("alert_notification") + ` GROUP BY type`
		query.Result = make([]*stats.NotifierUsageStats, 0)
		err := dbSession.SQL(rawSQL).Find(&query.Result)
		return err
	})
}

func (ss *sqlStatsService) GetDataSourceStats(ctx context.Context, query *stats.GetDataSourceStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type FROM ` + ss.db.GetDialect().Quote("data_source") + ` GROUP BY type`
		query.Result = make([]*stats.DataSourceStats, 0)
		err := dbSession.SQL(rawSQL).Find(&query.Result)
		return err
	})
}

func (ss *sqlStatsService) GetDataSourceAccessStats(ctx context.Context, query *stats.GetDataSourceAccessStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var rawSQL = `SELECT COUNT(*) AS count, type, access FROM ` + ss.db.GetDialect().Quote("data_source") + ` GROUP BY type, access`
		query.Result = make([]*stats.DataSourceAccessStats, 0)
		err := dbSession.SQL(rawSQL).Find(&query.Result)
		return err
	})
}

func notServiceAccount(dialect migrator.Dialect) string {
	return `is_service_account = ` +
		dialect.BooleanStr(false)
}

func (ss *sqlStatsService) GetSystemStats(ctx context.Context, query *stats.GetSystemStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		sb := &db.SQLBuilder{}
		sb.Write("SELECT ")
		dialect := ss.db.GetDialect()
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + `) AS users,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("org") + `) AS orgs,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_source") + `) AS datasources,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("star") + `) AS stars,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("playlist") + `) AS playlists,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("alert") + `) AS alerts,`)

		now := time.Now()
		activeUserDeadlineDate := now.Add(-activeUserTimeLimit)
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS active_users,`, activeUserDeadlineDate)

		dailyActiveUserDeadlineDate := now.Add(-dailyActiveUserTimeLimit)
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS daily_active_users,`, dailyActiveUserDeadlineDate)

		monthlyActiveUserDeadlineDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE `+
			notServiceAccount(dialect)+` AND last_seen_at > ?) AS monthly_active_users,`, monthlyActiveUserDeadlineDate)

		sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("dashboard")+` WHERE is_folder = ?) AS dashboards,`, dialect.BooleanStr(false))
		sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("dashboard")+` WHERE is_folder = ?) AS folders,`, dialect.BooleanStr(true))

		sb.Write(`(
		SELECT COUNT(acl.id)
		FROM `+dialect.Quote("dashboard_acl")+` AS acl
			INNER JOIN `+dialect.Quote("dashboard")+` AS d
			ON d.id = acl.dashboard_id
		WHERE d.is_folder = ?
	) AS dashboard_permissions,`, dialect.BooleanStr(false))

		sb.Write(`(
		SELECT COUNT(acl.id)
		FROM `+dialect.Quote("dashboard_acl")+` AS acl
			INNER JOIN `+dialect.Quote("dashboard")+` AS d
			ON d.id = acl.dashboard_id
		WHERE d.is_folder = ?
	) AS folder_permissions,`, dialect.BooleanStr(true))

		sb.Write(viewersPermissionsCounterSQL(ss.db, "dashboards_viewers_can_edit", false, dashboards.PERMISSION_EDIT))
		sb.Write(viewersPermissionsCounterSQL(ss.db, "dashboards_viewers_can_admin", false, dashboards.PERMISSION_ADMIN))
		sb.Write(viewersPermissionsCounterSQL(ss.db, "folders_viewers_can_edit", true, dashboards.PERMISSION_EDIT))
		sb.Write(viewersPermissionsCounterSQL(ss.db, "folders_viewers_can_admin", true, dashboards.PERMISSION_ADMIN))

		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_provisioning") + `) AS provisioned_dashboards,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_snapshot") + `) AS snapshots,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_version") + `) AS dashboard_versions,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("annotation") + `) AS annotations,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("team") + `) AS teams,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("user_auth_token") + `) AS auth_tokens,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("alert_rule") + `) AS alert_rules,`)
		sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("api_key") + `WHERE service_account_id IS NULL) AS api_keys,`)
		sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("library_element")+` WHERE kind = ?) AS library_panels,`, models.PanelElement)
		sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("library_element")+` WHERE kind = ?) AS library_variables,`, models.VariableElement)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_keys") + `) AS data_keys,`)
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_keys") + `WHERE active = true) AS active_data_keys,`)

		// TODO: table name will change and filter should check only for is_enabled = true
		sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("dashboard_public") + `WHERE is_enabled = true) AS public_dashboards,`)

		sb.Write(ss.roleCounterSQL(ctx))

		var stats stats.SystemStats
		_, err := dbSession.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&stats)
		if err != nil {
			return err
		}

		query.Result = &stats

		return nil
	})
}

func (ss *sqlStatsService) roleCounterSQL(ctx context.Context) string {
	const roleCounterTimeout = 20 * time.Second
	ctx, cancel := context.WithTimeout(ctx, roleCounterTimeout)
	defer cancel()
	_ = ss.updateUserRoleCountsIfNecessary(ctx, false)
	sqlQuery :=
		strconv.FormatInt(userStatsCache.total.Admins, 10) + ` AS admins, ` +
			strconv.FormatInt(userStatsCache.total.Editors, 10) + ` AS editors, ` +
			strconv.FormatInt(userStatsCache.total.Viewers, 10) + ` AS viewers, ` +
			strconv.FormatInt(userStatsCache.active.Admins, 10) + ` AS active_admins, ` +
			strconv.FormatInt(userStatsCache.active.Editors, 10) + ` AS active_editors, ` +
			strconv.FormatInt(userStatsCache.active.Viewers, 10) + ` AS active_viewers, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Admins, 10) + ` AS daily_active_admins, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Editors, 10) + ` AS daily_active_editors, ` +
			strconv.FormatInt(userStatsCache.dailyActive.Viewers, 10) + ` AS daily_active_viewers`

	return sqlQuery
}

func viewersPermissionsCounterSQL(db db.DB, statName string, isFolder bool, permission dashboards.PermissionType) string {
	dialect := db.GetDialect()
	return `(
		SELECT COUNT(*)
		FROM ` + dialect.Quote("dashboard_acl") + ` AS acl
			INNER JOIN ` + dialect.Quote("dashboard") + ` AS d
			ON d.id = acl.dashboard_id
		WHERE acl.role = '` + string(org.RoleViewer) + `'
			AND d.is_folder = ` + dialect.BooleanStr(isFolder) + `
			AND acl.permission = ` + strconv.FormatInt(int64(permission), 10) + `
	) AS ` + statName + `, `
}

func (ss *sqlStatsService) GetAdminStats(ctx context.Context, query *stats.GetAdminStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		dialect := ss.db.GetDialect()
		now := time.Now()
		activeEndDate := now.Add(-activeUserTimeLimit)
		dailyActiveEndDate := now.Add(-dailyActiveUserTimeLimit)
		monthlyActiveEndDate := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

		alertsQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", dialect.Quote("alert"))
		if ss.IsUnifiedAlertingEnabled() {
			alertsQuery = fmt.Sprintf("SELECT COUNT(*) FROM %s", dialect.Quote("alert_rule"))
		}

		var rawSQL = `SELECT
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("org") + `
		) AS orgs,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("dashboard") + `WHERE is_folder=` + dialect.BooleanStr(false) + `
		) AS dashboards,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("dashboard_snapshot") + `
		) AS snapshots,
		(
			SELECT COUNT( DISTINCT ( ` + dialect.Quote("term") + ` ))
			FROM ` + dialect.Quote("dashboard_tag") + `
		) AS tags,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("data_source") + `
		) AS datasources,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("playlist") + `
		) AS playlists,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("star") + `
		) AS stars,
		(` + alertsQuery + ` ) AS alerts,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + `
		) AS users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS active_users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS daily_active_users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE ` + notServiceAccount(dialect) + ` AND last_seen_at > ?
		) AS monthly_active_users,
		` + ss.roleCounterSQL(ctx) + `,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user_auth_token") + ` WHERE rotated_at > ?
		) AS active_sessions,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user_auth_token") + ` WHERE rotated_at > ?
		) AS daily_active_sessions`

		var stats stats.AdminStats
		_, err := dbSession.SQL(rawSQL, activeEndDate, dailyActiveEndDate, monthlyActiveEndDate, activeEndDate.Unix(), dailyActiveEndDate.Unix()).Get(&stats)
		if err != nil {
			return err
		}

		query.Result = &stats
		return nil
	})
}

func (ss *sqlStatsService) GetSystemUserCountStats(ctx context.Context, query *stats.GetSystemUserCountStatsQuery) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = `SELECT COUNT(id) AS Count FROM ` + ss.db.GetDialect().Quote("user")
		var stats stats.SystemUserCountStats
		_, err := sess.SQL(rawSQL).Get(&stats)
		if err != nil {
			return err
		}

		query.Result = &stats

		return nil
	})
}

func (ss *sqlStatsService) IsUnifiedAlertingEnabled() bool {
	return ss.cfg != nil && ss.cfg.UnifiedAlerting.IsEnabled()
}

func (ss *sqlStatsService) updateUserRoleCountsIfNecessary(ctx context.Context, forced bool) error {
	memoizationPeriod := time.Now().Add(-userStatsCacheLimetime)
	if forced || userStatsCache.memoized.Before(memoizationPeriod) {
		err := ss.updateUserRoleCounts(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

type memoUserStats struct {
	active      stats.UserStats
	dailyActive stats.UserStats
	total       stats.UserStats

	memoized time.Time
}

var (
	userStatsCache         = memoUserStats{}
	userStatsCacheLimetime = 5 * time.Minute
)

func (ss *sqlStatsService) updateUserRoleCounts(ctx context.Context) error {
	return ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := `
SELECT role AS bitrole, active, COUNT(role) AS count FROM
  (SELECT last_seen_at>? AS active, last_seen_at>? AS daily_active, SUM(role) AS role
   FROM (SELECT
      u.id,
      CASE org_user.role
        WHEN 'Admin' THEN 4
        WHEN 'Editor' THEN 2
        ELSE 1
      END AS role,
      u.last_seen_at
    FROM ` + ss.db.GetDialect().Quote("user") + ` AS u INNER JOIN org_user ON org_user.user_id = u.id
    GROUP BY u.id, u.last_seen_at, org_user.role) AS t2
  GROUP BY id, last_seen_at) AS t1
GROUP BY active, daily_active, role;`

		activeUserDeadline := time.Now().Add(-activeUserTimeLimit)
		dailyActiveUserDeadline := time.Now().Add(-dailyActiveUserTimeLimit)

		type rolebitmap struct {
			Active      bool
			DailyActive bool
			Bitrole     int64
			Count       int64
		}

		bitmap := []rolebitmap{}
		err := dbSession.Context(ctx).SQL(query, activeUserDeadline, dailyActiveUserDeadline).Find(&bitmap)
		if err != nil {
			return err
		}

		memo := memoUserStats{memoized: time.Now()}
		for _, role := range bitmap {
			roletype := org.RoleViewer
			if role.Bitrole&0b100 != 0 {
				roletype = org.RoleAdmin
			} else if role.Bitrole&0b10 != 0 {
				roletype = org.RoleEditor
			}

			memo.total = addToStats(memo.total, roletype, role.Count)
			if role.Active {
				memo.active = addToStats(memo.active, roletype, role.Count)
			}
			if role.DailyActive {
				memo.dailyActive = addToStats(memo.dailyActive, roletype, role.Count)
			}
		}

		userStatsCache = memo
		return nil
	})
}

func addToStats(base stats.UserStats, role org.RoleType, count int64) stats.UserStats {
	base.Users += count

	switch role {
	case org.RoleAdmin:
		base.Admins += count
	case org.RoleEditor:
		base.Editors += count
	default:
		base.Viewers += count
	}

	return base
}
