package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
	bus.AddHandler("sql", GetDataSourceAccessStats)
	bus.AddHandler("sql", GetAdminStats)
	bus.AddHandlerCtx("sql", GetAlertNotifiersUsageStats)
	bus.AddHandlerCtx("sql", GetSystemUserCountStats)
}

var activeUserTimeLimit = time.Hour * 24 * 30

func GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type FROM alert_notification GROUP BY type`
	query.Result = make([]*models.NotifierUsageStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetDataSourceStats(query *models.GetDataSourceStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type FROM data_source GROUP BY type`
	query.Result = make([]*models.DataSourceStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetDataSourceAccessStats(query *models.GetDataSourceAccessStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type, access FROM data_source GROUP BY type, access`
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
	sb.Write(`(SELECT COUNT(*) FROM `+dialect.Quote("user")+` where last_seen_at > ?) AS active_users,`, activeUserDeadlineDate)

	sb.Write(`(SELECT COUNT(id) FROM `+dialect.Quote("dashboard")+` where is_folder = ?) AS folders,`, dialect.BooleanStr(true))

	sb.Write(`(
		SELECT COUNT(acl.id)
		FROM `+dialect.Quote("dashboard_acl")+` as acl
			inner join `+dialect.Quote("dashboard")+` as d
			on d.id = acl.dashboard_id
		WHERE d.is_folder = ?
	) AS dashboard_permissions,`, dialect.BooleanStr(false))

	sb.Write(`(
		SELECT COUNT(acl.id)
		FROM `+dialect.Quote("dashboard_acl")+` as acl
			inner join `+dialect.Quote("dashboard")+` as d
			on d.id = acl.dashboard_id
		WHERE d.is_folder = ?
	) AS folder_permissions,`, dialect.BooleanStr(true))

	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_provisioning") + `) AS provisioned_dashboards,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_snapshot") + `) AS snapshots,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("team") + `) AS teams,`)
	sb.Write(`(SELECT COUNT(id) FROM ` + dialect.Quote("user_auth_token") + `) AS auth_tokens,`)

	sb.Write(roleCounterSQL("Viewer", "viewers")+`,`, activeUserDeadlineDate)
	sb.Write(roleCounterSQL("Editor", "editors")+`,`, activeUserDeadlineDate)
	sb.Write(roleCounterSQL("Admin", "admins")+``, activeUserDeadlineDate)

	var stats models.SystemStats
	_, err := x.SQL(sb.GetSqlString(), sb.params...).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats

	return err
}

func roleCounterSQL(role, alias string) string {
	return `
		(
			SELECT COUNT(DISTINCT u.id)
			FROM ` + dialect.Quote("user") + ` as u, org_user
			WHERE ( org_user.user_id=u.id AND org_user.role='` + role + `' )
		) as ` + alias + `,
		(
			SELECT COUNT(DISTINCT u.id)
			FROM ` + dialect.Quote("user") + ` as u, org_user
			WHERE u.last_seen_at>? AND ( org_user.user_id=u.id AND org_user.role='` + role + `' )
		) as active_` + alias
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
		SELECT COUNT(*) FROM ` + dialect.Quote("star") + `
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
		FROM ` + dialect.Quote("user") + ` where last_seen_at > ?
		) as active_users,
		` + roleCounterSQL("Admin", "admins") + `,
		` + roleCounterSQL("Editor", "editors") + `,
		` + roleCounterSQL("Viewer", "viewers") + `,
		(
		SELECT COUNT(*)
		FROM ` + dialect.Quote("user_auth_token") + ` where rotated_at > ?
		) as active_sessions
	  `

	var stats models.AdminStats
	_, err := x.SQL(rawSql, activeEndDate, activeEndDate, activeEndDate, activeEndDate, activeEndDate.Unix()).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats
	return err
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

		return err
	})
}
