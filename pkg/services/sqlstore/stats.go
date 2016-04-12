package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
	bus.AddHandler("sql", GetAdminStats)
}

func GetDataSourceStats(query *m.GetDataSourceStatsQuery) error {
	var rawSql = `SELECT COUNT(*) as count, type FROM data_source GROUP BY type`
	query.Result = make([]*m.DataSourceStats, 0)
	err := x.Sql(rawSql).Find(&query.Result)
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
      ) AS user_count,
			(
				SELECT COUNT(*)
        FROM ` + dialect.Quote("org") + `
      ) AS org_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("dashboard") + `
      ) AS dashboard_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("playlist") + `
      ) AS playlist_count
			`

	var stats m.SystemStats
	_, err := x.Sql(rawSql).Get(&stats)
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
      ) AS user_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("org") + `
      ) AS org_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("dashboard") + `
      ) AS dashboard_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("dashboard_snapshot") + `
      ) AS db_snapshot_count,
      (
        SELECT COUNT( DISTINCT ( ` + dialect.Quote("term") + ` ))
        FROM ` + dialect.Quote("dashboard_tag") + `
      ) AS db_tag_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("data_source") + `
      ) AS data_source_count,
      (
        SELECT COUNT(*)
        FROM ` + dialect.Quote("playlist") + `
      ) AS playlist_count,
      (
        SELECT COUNT(DISTINCT ` + dialect.Quote("dashboard_id") + ` )
        FROM ` + dialect.Quote("star") + `
      ) AS starred_db_count
      `

	var stats m.AdminStats
	_, err := x.Sql(rawSql).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats
	return err
}
