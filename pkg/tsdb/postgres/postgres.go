package postgres

import (
	"container/list"
	"context"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"time"

	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type PostgresQueryEndpoint struct {
	sqlEngine tsdb.SqlEngine
	log       log.Logger
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("postgres", NewPostgresQueryEndpoint)
}

func NewPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	endpoint := &PostgresQueryEndpoint{
		log: log.New("tsdb.postgres"),
	}

	endpoint.sqlEngine = &tsdb.DefaultSqlEngine{
		MacroEngine: NewPostgresMacroEngine(),
	}

	cnnstr := generateConnectionString(datasource)
	endpoint.log.Debug("getEngine", "connection", cnnstr)

	if err := endpoint.sqlEngine.InitEngine("postgres", datasource, cnnstr); err != nil {
		return nil, err
	}

	return endpoint, nil
}

func generateConnectionString(datasource *models.DataSource) string {
	password := ""
	for key, value := range datasource.SecureJsonData.Decrypt() {
		if key == "password" {
			password = value
			break
		}
	}

	sslmode := datasource.JsonData.Get("sslmode").MustString("verify-full")
	u := &url.URL{Scheme: "postgres", User: url.UserPassword(datasource.User, password), Host: datasource.Url, Path: datasource.Database, RawQuery: "sslmode=" + sslmode}
	return u.String()
}

func (e *PostgresQueryEndpoint) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	return e.sqlEngine.Query(ctx, dsInfo, tsdbQuery, e.transformToTimeSeries, e.transformToTable)
}

func (e PostgresQueryEndpoint) transformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, len(columnNames)),
		Rows:    make([]tsdb.RowValues, 0),
	}

	for i, name := range columnNames {
		table.Columns[i].Text = name
	}

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1

	// check if there is a column named time
	for i, col := range columnNames {
		switch col {
		case "time":
			timeIndex = i
		}
	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		// convert column named time to unix timestamp to make
		// native datetime postgres types work in annotation queries
		if timeIndex != -1 {
			switch value := values[timeIndex].(type) {
			case time.Time:
				values[timeIndex] = float64(value.UnixNano() / 1e9)
			}
		}

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e PostgresQueryEndpoint) getTypedRowData(rows *core.Rows) (tsdb.RowValues, error) {

	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	values := make([]interface{}, len(types))
	valuePtrs := make([]interface{}, len(types))

	for i := 0; i < len(types); i++ {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	// convert types not handled by lib/pq
	// unhandled types are returned as []byte
	for i := 0; i < len(types); i++ {
		if value, ok := values[i].([]byte); ok == true {
			switch types[i].DatabaseTypeName() {
			case "NUMERIC":
				if v, err := strconv.ParseFloat(string(value), 64); err == nil {
					values[i] = v
				} else {
					e.log.Debug("Rows", "Error converting numeric to float", value)
				}
			case "UNKNOWN", "CIDR", "INET", "MACADDR":
				// char literals have type UNKNOWN
				values[i] = string(value)
			default:
				e.log.Debug("Rows", "Unknown database type", types[i].DatabaseTypeName(), "value", value)
				values[i] = string(value)
			}
		}
	}

	return values, nil
}

func (e PostgresQueryEndpoint) transformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	seriesByQueryOrder := list.New()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1
	metricIndex := -1

	// check columns of resultset: a column named time is mandatory
	// the first text column is treated as metric name unless a column named metric is present
	for i, col := range columnNames {
		switch col {
		case "time":
			timeIndex = i
		case "metric":
			metricIndex = i
		default:
			if metricIndex == -1 {
				switch columnTypes[i].DatabaseTypeName() {
				case "UNKNOWN", "TEXT", "VARCHAR", "CHAR":
					metricIndex = i
				}
			}
		}
	}

	if timeIndex == -1 {
		return fmt.Errorf("Found no column named time")
	}

	fillMissing := query.Model.Get("fill").MustBool(false)
	var fillInterval float64
	fillValue := null.Float{}
	if fillMissing {
		fillInterval = query.Model.Get("fillInterval").MustFloat64() * 1000
		if query.Model.Get("fillNull").MustBool(false) == false {
			fillValue.Float64 = query.Model.Get("fillValue").MustFloat64()
			fillValue.Valid = true
		}

	}

	for rows.Next() {
		var timestamp float64
		var value null.Float
		var metric string

		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		switch columnValue := values[timeIndex].(type) {
		case int64:
			timestamp = float64(columnValue * 1000)
		case float64:
			timestamp = columnValue * 1000
		case time.Time:
			timestamp = float64(columnValue.UnixNano() / 1e6)
		default:
			return fmt.Errorf("Invalid type for column time, must be of type timestamp or unix timestamp, got: %T %v", columnValue, columnValue)
		}

		if metricIndex >= 0 {
			if columnValue, ok := values[metricIndex].(string); ok == true {
				metric = columnValue
			} else {
				return fmt.Errorf("Column metric must be of type char,varchar or text, got: %T %v", values[metricIndex], values[metricIndex])
			}
		}

		for i, col := range columnNames {
			if i == timeIndex || i == metricIndex {
				continue
			}

			switch columnValue := values[i].(type) {
			case int64:
				value = null.FloatFrom(float64(columnValue))
			case float64:
				value = null.FloatFrom(columnValue)
			case nil:
				value.Valid = false
			default:
				return fmt.Errorf("Value column must have numeric datatype, column: %s type: %T value: %v", col, columnValue, columnValue)
			}
			if metricIndex == -1 {
				metric = col
			}

			series, exist := pointsBySeries[metric]
			if exist == false {
				series = &tsdb.TimeSeries{Name: metric}
				pointsBySeries[metric] = series
				seriesByQueryOrder.PushBack(metric)
			}

			if fillMissing {
				var intervalStart float64
				if exist == false {
					intervalStart = float64(tsdbQuery.TimeRange.MustGetFrom().UnixNano() / 1e6)
				} else {
					intervalStart = series.Points[len(series.Points)-1][1].Float64 + fillInterval
				}

				// align interval start
				intervalStart = math.Floor(intervalStart/fillInterval) * fillInterval

				for i := intervalStart; i < timestamp; i += fillInterval {
					series.Points = append(series.Points, tsdb.TimePoint{fillValue, null.FloatFrom(i)})
					rowCount++
				}
			}

			series.Points = append(series.Points, tsdb.TimePoint{value, null.FloatFrom(timestamp)})

			e.log.Debug("Rows", "metric", metric, "time", timestamp, "value", value)
			rowCount++

		}
	}

	for elem := seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
		key := elem.Value.(string)
		result.Series = append(result.Series, pointsBySeries[key])

		if fillMissing {
			series := pointsBySeries[key]
			// fill in values from last fetched value till interval end
			intervalStart := series.Points[len(series.Points)-1][1].Float64
			intervalEnd := float64(tsdbQuery.TimeRange.MustGetTo().UnixNano() / 1e6)

			// align interval start
			intervalStart = math.Floor(intervalStart/fillInterval) * fillInterval
			for i := intervalStart + fillInterval; i < intervalEnd; i += fillInterval {
				series.Points = append(series.Points, tsdb.TimePoint{fillValue, null.FloatFrom(i)})
				rowCount++
			}
		}
	}

	result.Meta.Set("rowCount", rowCount)
	return nil
}
