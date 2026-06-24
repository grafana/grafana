package fsql

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

type queryModel struct {
	*sqlutil.Query
}

// queryRequest is an inbound query request as part of a batch of queries sent
// to [(*FlightSQLDatasource).QueryData].
type queryRequest struct {
	RefID                string `json:"refId"`
	RawQuery             string `json:"rawSql"`
	IntervalMilliseconds int    `json:"intervalMs"`
	MaxDataPoints        int64  `json:"maxDataPoints"`
	Format               string `json:"format"`
}

func getQueryModel(dataQuery backend.DataQuery) (*queryModel, error) {
	var q queryRequest
	if err := json.Unmarshal(dataQuery.JSON, &q); err != nil {
		return nil, fmt.Errorf("unmarshal json: %w", err)
	}

	var format sqlutil.FormatQueryOption
	switch q.Format {
	case "time_series":
		format = sqlutil.FormatOptionTimeSeries
	case "table":
		format = sqlutil.FormatOptionTable
	default:
		format = sqlutil.FormatOptionTimeSeries
	}

	query := &sqlutil.Query{
		RawSQL:        q.RawQuery,
		RefID:         q.RefID,
		MaxDataPoints: q.MaxDataPoints,
		Interval:      time.Duration(q.IntervalMilliseconds) * time.Millisecond,
		TimeRange:     dataQuery.TimeRange,
		Format:        format,
	}

	// Process macros and generate raw fsql to be sent to
	// influxdb backend for execution.
	sql, err := sqlutil.Interpolate(query, macros)
	if err != nil {
		return nil, fmt.Errorf("macro interpolation: %w", err)
	}
	query.RawSQL = sql

	return &queryModel{query}, nil
}
