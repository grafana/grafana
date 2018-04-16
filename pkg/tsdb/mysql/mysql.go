package mysql

import (
	"container/list"
	"context"
	"database/sql"
	"fmt"
	"math"
	"reflect"
	"strconv"

	"github.com/go-sql-driver/mysql"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MysqlQueryEndpoint struct {
	sqlEngine tsdb.SqlEngine
	log       log.Logger
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mysql", NewMysqlQueryEndpoint)
}

func NewMysqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	endpoint := &MysqlQueryEndpoint{
		log: log.New("tsdb.mysql"),
	}

	endpoint.sqlEngine = &tsdb.DefaultSqlEngine{
		MacroEngine: NewMysqlMacroEngine(),
	}

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&parseTime=true&loc=UTC&allowNativePasswords=true",
		datasource.User,
		datasource.Password,
		"tcp",
		datasource.Url,
		datasource.Database,
	)
	endpoint.log.Debug("getEngine", "connection", cnnstr)

	if err := endpoint.sqlEngine.InitEngine("mysql", datasource, cnnstr); err != nil {
		return nil, err
	}

	return endpoint, nil
}

// Query is the main function for the MysqlExecutor
func (e *MysqlQueryEndpoint) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	return e.sqlEngine.Query(ctx, dsInfo, tsdbQuery, e.transformToTimeSeries, e.transformToTable)
}

func (e MysqlQueryEndpoint) transformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {
	columnNames, err := rows.Columns()
	columnCount := len(columnNames)

	if err != nil {
		return err
	}

	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, columnCount),
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
		case "time", "time_sec":
			timeIndex = i
		}
	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("MySQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		// converts column named time to unix timestamp in milliseconds to make
		// native mysql datetime types and epoch dates work in
		// annotation and table queries.
		tsdb.ConvertSqlTimeColumnToEpochMs(values, timeIndex)

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e MysqlQueryEndpoint) getTypedRowData(rows *core.Rows) (tsdb.RowValues, error) {
	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	values := make([]interface{}, len(types))

	for i := range values {
		scanType := types[i].ScanType()
		values[i] = reflect.New(scanType).Interface()

		if types[i].DatabaseTypeName() == "BIT" {
			values[i] = new([]byte)
		}
	}

	if err := rows.Scan(values...); err != nil {
		return nil, err
	}

	for i := 0; i < len(types); i++ {
		typeName := reflect.ValueOf(values[i]).Type().String()

		switch typeName {
		case "*sql.RawBytes":
			values[i] = string(*values[i].(*sql.RawBytes))
		case "*mysql.NullTime":
			sqlTime := (*values[i].(*mysql.NullTime))
			if sqlTime.Valid {
				values[i] = sqlTime.Time
			} else {
				values[i] = nil
			}
		case "*sql.NullInt64":
			nullInt64 := (*values[i].(*sql.NullInt64))
			if nullInt64.Valid {
				values[i] = nullInt64.Int64
			} else {
				values[i] = nil
			}
		case "*sql.NullFloat64":
			nullFloat64 := (*values[i].(*sql.NullFloat64))
			if nullFloat64.Valid {
				values[i] = nullFloat64.Float64
			} else {
				values[i] = nil
			}
		}

		if types[i].DatabaseTypeName() == "DECIMAL" {
			f, err := strconv.ParseFloat(values[i].(string), 64)

			if err == nil {
				values[i] = f
			} else {
				values[i] = nil
			}
		}
	}

	return values, nil
}

func (e MysqlQueryEndpoint) transformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {
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
		case "time", "time_sec":
			timeIndex = i
		case "metric":
			metricIndex = i
		default:
			if metricIndex == -1 {
				switch columnTypes[i].DatabaseTypeName() {
				case "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT":
					metricIndex = i
				}
			}
		}
	}

	if timeIndex == -1 {
		return fmt.Errorf("Found no column named time or time_sec")
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

		// converts column named time to unix timestamp in milliseconds to make
		// native mysql datetime types and epoch dates work in
		// annotation and table queries.
		tsdb.ConvertSqlTimeColumnToEpochMs(values, timeIndex)

		switch columnValue := values[timeIndex].(type) {
		case int64:
			timestamp = float64(columnValue)
		case float64:
			timestamp = columnValue
		default:
			return fmt.Errorf("Invalid type for column time/time_sec, must be of type timestamp or unix timestamp, got: %T %v", columnValue, columnValue)
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
