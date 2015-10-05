package sqlstore

import (
	"github.com/Cepave/grafana/pkg/bus"
	m "github.com/Cepave/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetSystemStats)
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
