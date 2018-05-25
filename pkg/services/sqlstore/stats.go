package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
	bus.AddHandler("sql", GetDataSourceAccessStats)
	bus.AddHandler("sql", GetAdminStats)
	bus.AddHandler("sql", GetSystemUserCountStats)
}

var activeUserTimeLimit = time.Hour * 24 * 30

func GetDataSourceStats(query *m.GetDataSourceStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type FROM data_source GROUP BY type`
	query.Result = make([]*m.DataSourceStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetDataSourceAccessStats(query *m.GetDataSourceAccessStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type, access FROM data_source GROUP BY type, access`
	query.Result = make([]*m.DataSourceAccessStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	return err
}

func GetSystemStats(query *m.GetSystemStatsQuery) error {
	var rawSql = `SELECT
			(
				SELECT COUNT(*)
		FROM ` + dialect.Quote("user") + `
	  ) AS users,
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
		FROM ` + dialect.Quote("data_source") + `
	  ) AS datasources,
	  (
		SELECT COUNT(*) FROM ` + dialect.Quote("star") + `
	  ) AS stars,
	  (
		SELECT COUNT(*)
		FROM ` + dialect.Quote("playlist") + `
	  ) AS playlists,
	  (
		SELECT COUNT(*)
		FROM ` + dialect.Quote("alert") + `
	  ) AS alerts,
		(
			SELECT COUNT(*) FROM ` + dialect.Quote("user") + ` where last_seen_at > ?
		) as active_users,
		(
			SELECT COUNT(id) FROM ` + dialect.Quote("dashboard") + ` where is_folder = ?
		) as folders,
		(
			SELECT COUNT(acl.id) FROM ` + dialect.Quote("dashboard_acl") + ` as acl inner join ` + dialect.Quote("dashboard") + ` as d on d.id = acl.dashboard_id where d.is_folder = ?
	  ) as dashboard_permissions,
		(
			SELECT COUNT(acl.id) FROM ` + dialect.Quote("dashboard_acl") + ` as acl inner join ` + dialect.Quote("dashboard") + ` as d on d.id = acl.dashboard_id where d.is_folder = ?
		) as folder_permissions,
		(
			SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_provisioning") + `
		) as provisioned_dashboards,
		(
			SELECT COUNT(id) FROM ` + dialect.Quote("dashboard_snapshot") + `
		) as snapshots,
		(
			SELECT COUNT(id) FROM ` + dialect.Quote("team") + `
		) as teams
			`

	activeUserDeadlineDate := time.Now().Add(-activeUserTimeLimit)
	var stats m.SystemStats
	_, err := x.SQL(rawSql, activeUserDeadlineDate, dialect.BooleanStr(true), dialect.BooleanStr(false), dialect.BooleanStr(true)).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats

	return err
}

func GetAdminStats(query *m.GetAdminStatsQuery) error {
	var rawSql = `SELECT
	  (
		SELECT COUNT(*)
		FROM ` + dialect.Quote("user") + `
	  ) AS users,
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
		from ` + dialect.Quote("user") + ` where last_seen_at > ?
			) as active_users
	  `

	activeUserDeadlineDate := time.Now().Add(-activeUserTimeLimit)

	var stats m.AdminStats
	_, err := x.SQL(rawSql, activeUserDeadlineDate).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats
	return err
}

func GetSystemUserCountStats(query *m.GetSystemUserCountStatsQuery) error {
	var rawSql = `SELECT COUNT(id) AS Count FROM ` + dialect.Quote("user")
	var stats m.SystemUserCountStats
	_, err := x.SQL(rawSql).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats

	return err
}
