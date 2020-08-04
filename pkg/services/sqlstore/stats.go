package sqlstore

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
	bus.AddHandler("sql", GetDataSourceAccessStats)
	bus.AddHandler("sql", GetAdminStats)
	bus.AddHandler("sql", GetUserStats)
	bus.AddHandlerCtx("sql", GetAlertNotifiersUsageStats)
	bus.AddHandlerCtx("sql", GetSystemUserCountStats)
}

const activeUserTimeLimit = time.Hour * 24 * 30

func GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error {
	var rawSql = `SELECT COUNT(*) AS count, type FROM ` + dialect.Quote("alert_notification") + ` GROUP BY type`
	query.Result = make([]*models.NotifierUsageStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetDataSourceStats(query *models.GetDataSourceStatsQuery) error {
	var rawSql = `SELECT COUNT(*) AS count, type FROM ` + dialect.Quote("data_source") + ` GROUP BY type`
	query.Result = make([]*models.DataSourceStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetDataSourceAccessStats(query *models.GetDataSourceAccessStatsQuery) error {
	var rawSql = `SELECT COUNT(*) AS count, type, access FROM ` + dialect.Quote("data_source") + ` GROUP BY type, access`
	query.Result = make([]*models.DataSourceAccessStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetSystemStats(query *models.GetSystemStatsQuery) error {
	sb := &SqlBuilder{}
	sb.Write("SELECT ")
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("user") + `) AS users,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("org") + `) AS orgs,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("dashboard") + `) AS dashboards,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("data_source") + `) AS datasources,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("star") + `) AS stars,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("playlist") + `) AS playlists,`)
	sb.Write(`(SELECT COUNT(*) FROM ` + dialect.Quote("alert") + `) AS alerts,`)

	activeUserDeadlineDate := time.Now().Add(-activeUserTimeLimit)
	sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` WHERE last_seen_at > ?) AS active_users,`, activeUserDeadlineDate)

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

	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_provisioning") + `) AS provisioned_dashboards,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_snapshot") + `) AS snapshots,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_version") + `) AS dashboard_versions,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("annotation") + `) AS annotations,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("team") + `) AS teams,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("user_auth_token") + `) AS auth_tokens,`)

	sb.Write(roleCounterSQL())

	var stats models.SystemStats
	_, err := x.SQL(sb.GetSqlString(), sb.params...).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats

	return nil
}

func roleCounterSQL() string {
	_ = updateUserRoleCountsIfNecessary(false)
	sqlQuery :=
		strconv.FormatInt(userRoleCount.total.Admins, 10) + ` AS admins, ` +
			strconv.FormatInt(userRoleCount.total.Editors, 10) + ` AS editors, ` +
			strconv.FormatInt(userRoleCount.total.Viewers, 10) + ` AS viewers, ` +
			strconv.FormatInt(userRoleCount.active.Admins, 10) + ` AS active_admins, ` +
			strconv.FormatInt(userRoleCount.active.Editors, 10) + ` AS active_editors, ` +
			strconv.FormatInt(userRoleCount.active.Viewers, 10) + ` AS active_viewers`

	return sqlQuery
}

func GetAdminStats(query *models.GetAdminStatsQuery) error {
	activeEndDate := time.Now().Add(-activeUserTimeLimit)

	var rawSql = `SELECT
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("org") + `
		) AS orgs,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("dashboard") + `
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
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("alert") + `
		) AS alerts,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + `
		) AS users,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user") + ` WHERE last_seen_at > ?
		) AS active_users,
		` + roleCounterSQL() + `,
		(
			SELECT COUNT(*)
			FROM ` + dialect.Quote("user_auth_token") + ` WHERE rotated_at > ?
		) AS active_sessions`

	var stats models.AdminStats
	_, err := x.SQL(rawSql, activeEndDate, activeEndDate, activeEndDate, activeEndDate, activeEndDate.Unix()).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats
	return nil
}

func GetSystemUserCountStats(ctx context.Context, query *models.GetSystemUserCountStatsQuery) error {
	return withDbSession(ctx, func(sess *DBSession) error {
		var rawSql = `SELECT COUNT(id) AS Count FROM ` + dialect.Quote("user")
		var stats models.SystemUserCountStats
		_, err := sess.SQL(rawSql).Get(&stats)
		if err != nil {
			return err
		}

		query.Result = &stats

		return nil
	})
}

func GetUserStats(query *models.GetUserStatsQuery) error {
	err := updateUserRoleCountsIfNecessary(query.MustUpdate)
	if err != nil {
		return err
	}

	if query.Active {
		query.Result = userRoleCount.active
	} else {
		query.Result = userRoleCount.total
	}

	return nil
}

func updateUserRoleCountsIfNecessary(forced bool) error {
	memoizationPeriod := time.Now().Add(-1 * time.Hour)
	if forced || userRoleCount.memoized.Before(memoizationPeriod) {
		err := updateUserRoleCounts()
		if err != nil {
			return err
		}
	}
	return nil
}

type memoUserStats struct {
	active models.UserStats
	total  models.UserStats

	memoized time.Time
}

var userRoleCount = memoUserStats{}

func updateUserRoleCounts() error {
	// 5 million users max cap is arbitrarily chosen to prevent this
	// from taking far too much time.
	const pageLimit = 100
	const perPageLimit = 50000

	type userRoles struct {
		ID         int64 `xorm:"id"`
		LastSeenAt time.Time
		Role       models.RoleType
	}

	activeUserDeadline := time.Now().Add(-activeUserTimeLimit)

	memo := memoUserStats{memoized: time.Now()}

	_, err := x.Transaction(func(session *xorm.Session) (interface{}, error) {
		for offset := 0; offset < pageLimit; offset += perPageLimit {
			usersSlice := make([]userRoles, 0, perPageLimit)
			err := session.SQL(`SELECT u.id, u.last_seen_at, org_user.role
    FROM (SELECT id, last_seen_at FROM user LIMIT ? OFFSET ?) AS u LEFT JOIN org_user ON org_user.user_id = u.id
    GROUP BY u.id, org_user.role;`, perPageLimit, offset).Find(&usersSlice)
			if err != nil {
				return nil, err
			}

			if len(usersSlice) == 0 {
				break
			}

			activeMap := make(map[int64]models.RoleType, perPageLimit)
			totalMap := make(map[int64]models.RoleType, perPageLimit)

			for _, user := range usersSlice {
				fmt.Println(user)
				if current, exists := activeMap[user.ID]; exists {
					if current == models.ROLE_ADMIN {
						continue
					} else if current == models.ROLE_EDITOR && user.Role == models.ROLE_VIEWER {
						continue
					}
				}

				if user.LastSeenAt.After(activeUserDeadline) {
					activeMap[user.ID] = user.Role
				}
				totalMap[user.ID] = user.Role
			}

			memo.active = mapToStats(memo.active, activeMap)
			memo.total = mapToStats(memo.total, totalMap)
		}
		return nil, nil
	})
	if err != nil {
		return err
	}

	userRoleCount = memo
	return nil
}

func mapToStats(base models.UserStats, us map[int64]models.RoleType) models.UserStats {
	base.Users += int64(len(us))

	for _, role := range us {
		switch role {
		case models.ROLE_ADMIN:
			base.Admins++
		case models.ROLE_EDITOR:
			base.Editors++
		case models.ROLE_VIEWER:
			base.Viewers++
		}
	}

	return base
}
