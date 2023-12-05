package prql

import "github.com/grafana/grafana-plugin-sdk-go/data"

func Query(id string, prql string) (data.Frames, error) {
	sql, err := Convert(prql)
	if err != nil {
		return nil, err
	}

	duckDB := DuckDB{Name: id}
	return duckDB.Query(sql)
}
