package sqlstore

import (
	"github.com/Cepave/grafana/pkg/bus"
	m "github.com/Cepave/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
	bus.AddHandler("sql", GetDataSourceStats)
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
      ) AS dashboard_count
			`

	var stats m.SystemStats
	_, err := x.Sql(rawSql).Get(&stats)
	if err != nil {
		return err
	}

	query.Result = &stats
	return err
}
