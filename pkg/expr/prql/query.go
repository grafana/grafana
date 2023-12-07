package prql

import (
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func Query(id string, prql string) (data.Frames, error) {
	sql, err := Convert(prql, "duckdb")
	if err != nil {
		// TODO... should check for first non-comment token?
		if !strings.Contains(strings.ToLower(prql), "select") {
			return nil, err
		}
		sql = prql // it is actually SQL syntax!
	}

	duckDB := DuckDB{Name: id}
	return duckDB.Query(sql)
}
