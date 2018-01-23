package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
	bus.AddHandler("sql", GetAdminStats)
}

var activeUserTimeLimit time.Duration = time.Hour * 24 * 30

func GetDataSourceStats(query *m.GetDataSourceStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type FROM data_source GROUP BY type`
	query.Result = make([]*m.DataSourceStats, 0)
	err := x.SQL(rawSql).Find(&query.Result)
	if err != nil {
		return err
	}

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
	  ) as active_users
			`

	activeUserDeadlineDate := time.Now().Add(-activeUserTimeLimit)
	var stats m.SystemStats
	_, err := x.SQL(rawSql, activeUserDeadlineDate).Get(&stats)
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
